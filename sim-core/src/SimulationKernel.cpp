#include "SimulationKernel.h"

#include "ActionType.h"
#include "ExecutionBudget.h"
#include "sim-adjudication/MicroWorldAdjudicator.h"

#include <algorithm>
#include <iomanip>
#include <sstream>
#include <stdexcept>

namespace darla {
namespace {

std::string fixed(double value) {
    std::ostringstream out;
    out << std::fixed << std::setprecision(2) << value;
    return out.str();
}

PythonScriptRuntimeState* runtimeState(WorldState& world, const std::string& script_id) {
    auto it = std::find_if(
        world.python_script_runtime.begin(),
        world.python_script_runtime.end(),
        [&](const PythonScriptRuntimeState& state) { return state.script_id == script_id; });
    return it == world.python_script_runtime.end() ? nullptr : &*it;
}

} // namespace

void SimulationKernel::initialize(const SimConfig& config) {
    config_ = config;
    world_ = WorldState{};
    ledger_ = EventLedger{};
    causal_graph_ = TemporalCausalGraph{};
    rng_.seed(config.seed);
}

void SimulationKernel::loadScenario(const Scenario& scenario) {
    initialize(scenario.config);
    world_.mission = scenario.mission;
    world_.environment = scenario.environment;
    world_.open_data = scenario.open_data;
    world_.ais_tracks = scenario.ais_tracks;
    world_.scripted_events = scenario.scripted_events;
    world_.fmu_configs = scenario.fmus;
    world_.planted_truth = scenario.planted_causal_truth;
    world_.scm = scenario.scm;
    world_.scm_noise_seed = scenario.config.seed;
    for (const auto& entity : scenario.entities) {
        world_.ids_by_name[entity.name] = entity.id;
        world_.entities[entity.id] = entity;
        for (const auto& script : entity.python_scripts) {
            world_.python_script_runtime.push_back(PythonScriptRuntimeState{
                scriptIdFor(script),
                script.object_id,
                script.script_path,
                script.class_name,
                script.enabled,
                false,
                "not_loaded",
                "",
                0,
                0,
                0,
                0});
        }
    }
    if (script_runtime_) {
        script_runtime_->loadScenarioScripts(scenario, *this);
    }
}

void SimulationKernel::step() {
    if (world_.tick >= config_.max_ticks) return;
    resetTickBudgetUsage(world_.runtime_budgets);
    const auto previous_event_count = ledger_.events().size();
    MicroWorldAdjudicator adjudicator;
    adjudicator.adjudicate(world_, ledger_, causal_graph_);
    notifyScriptsForNewEvents(previous_event_count);
    if (script_runtime_) {
        script_runtime_->onTick(*this, config_.tick_seconds);
    }
    ++world_.tick;
}

void SimulationKernel::runUntil(Tick end_tick) {
    while (world_.tick < end_tick && world_.tick < config_.max_ticks) {
        step();
    }
}

Snapshot SimulationKernel::snapshot() const {
    return Snapshot{world_, ledger_, causal_graph_};
}

void SimulationKernel::restore(const Snapshot& snapshot) {
    world_ = snapshot.world;
    ledger_ = snapshot.ledger;
    causal_graph_ = snapshot.causal_graph;
    rng_.seed(config_.seed + world_.tick);
}

void SimulationKernel::setScriptRuntime(ScriptRuntime* runtime) {
    script_runtime_ = runtime;
}

void SimulationKernel::notifyScriptsForNewEvents(std::size_t previous_event_count) {
    if (!script_runtime_) return;
    const auto& events = ledger_.events();
    for (std::size_t i = previous_event_count; i < events.size(); ++i) {
        script_runtime_->onEvent(*this, events[i]);
    }
}

bool SimulationKernel::applyScriptCommand(const ScriptCommand& command, std::string* error) {
    const auto* actor = world_.entityByName(command.object_id);
    if (!actor) {
        if (error) *error = "script actor does not exist: " + command.object_id;
        return false;
    }

    auto* state = runtimeState(world_, command.script_id);
    const std::string provenance = "python_script:" + command.script_id;

    try {
        switch (command.type) {
        case ScriptCommandType::Log:
            ledger_.append(SimEvent{
                0,
                world_.tick,
                actor->id,
                EventType::Observe,
                {},
                {},
                {},
                {"python-script-v0"},
                command.confidence,
                0.0,
                0.05,
                provenance,
                "script component log",
                command.label});
            return true;

        case ScriptCommandType::EmitEvent: {
            std::vector<EntityId> targets;
            if (!command.target.empty()) {
                const auto* target = world_.entityByName(command.target);
                if (!target) {
                    if (error) *error = "script event target does not exist: " + command.target;
                    return false;
                }
                targets.push_back(target->id);
            }
            ledger_.append(SimEvent{
                0,
                world_.tick,
                actor->id,
                EventType::Observe,
                targets,
                {{"script.event_type", "", command.action}},
                {},
                {"python-script-v0"},
                command.confidence,
                0.08,
                0.12,
                provenance,
                "script component emitted event",
                command.label.empty() ? command.action : command.label});
            if (state) {
                state->emitted_events += 1;
                state->last_tick = world_.tick;
            }
            return true;
        }

        case ScriptCommandType::ProposeCoa: {
            auto* target = world_.entityByName(command.target);
            if (!target) {
                if (error) *error = "script COA target does not exist: " + command.target;
                return false;
            }
            CourseOfAction coa;
            coa.id = world_.next_coa_id++;
            coa.proposed_tick = world_.tick;
            coa.action = actionTypeFromString(command.action);
            coa.target = command.target;
            coa.expected_mission_gain = command.expected_mission_gain;
            coa.causal_confidence = command.causal_confidence;
            coa.cost = command.cost;
            coa.risk = command.risk;
            coa.score = command.expected_mission_gain * command.causal_confidence - command.cost - command.risk;
            coa.rationale = command.rationale;
            coa.status = CoaStatus::Recommended;
            world_.coa_log.push_back(coa);

            ledger_.append(SimEvent{
                0,
                world_.tick,
                actor->id,
                EventType::DecideCOA,
                {target->id},
                {{"coa.recommendation", "none", command.action},
                 {"coa.score", "0.00", fixed(coa.score)}},
                {},
                {"python-script-v0"},
                command.causal_confidence,
                0.10,
                0.18,
                provenance,
                "script component proposed COA",
                "python_coa:" + command.action});
            if (state) {
                state->proposed_coas += 1;
                state->last_tick = world_.tick;
            }
            return true;
        }

        case ScriptCommandType::ScheduleAction:
            if (!world_.entityByName(command.target)) {
                if (error) *error = "script action target does not exist: " + command.target;
                return false;
            }
            world_.scheduled_interventions.push_back(ScheduledIntervention{command.action, command.at_tick, command.target, false});
            ledger_.append(SimEvent{
                0,
                world_.tick,
                actor->id,
                EventType::PolicyChangeProposed,
                {},
                {{"scheduled_intervention", "none", command.action + "@" + std::to_string(command.at_tick)}},
                {},
                {"python-script-v0"},
                command.confidence,
                0.08,
                0.14,
                provenance,
                "script component scheduled action",
                "python_schedule:" + command.action});
            if (state) {
                state->scheduled_actions += 1;
                state->last_tick = world_.tick;
            }
            return true;
        }
    } catch (const std::exception& ex) {
        if (error) *error = ex.what();
        return false;
    }

    if (error) *error = "unknown script command type";
    return false;
}

} // namespace darla
