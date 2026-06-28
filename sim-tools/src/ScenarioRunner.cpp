#include "sim-tools/ScenarioRunner.h"

#ifdef DARLA_ENABLE_PYTHON_SCRIPTING
#include "sim-scripting/PythonRuntime.h"
#endif

#include <stdexcept>

namespace darla {

void configureAgentRuntime(
    WorldState& world,
    const Scenario& scenario,
    RelationshipGraph& graph,
    CausalActionEstimator& estimator,
    bool enable_realtime_agents,
    AuthorizationMode authorization_mode,
    const std::vector<ApprovedCoa>& approved_coas) {
    graph = RelationshipGraph::fromScenario(scenario);
    world.realtime_agents_enabled = enable_realtime_agents;
    world.authorization_mode = authorization_mode;
    world.approved_coas = approved_coas;
    world.agent_runtime.relationships = &graph;
    world.agent_runtime.estimator = &estimator;
    world.agent_runtime.horizon_ticks = scenario.config.max_ticks;
}

ScenarioRun runScenarioFile(const std::filesystem::path& scenario_path, const ScenarioRunOptions& options) {
    ScenarioLoader loader;
    Scenario scenario = loader.load(scenario_path);
    if (options.seed_override) {
        scenario.config.seed = *options.seed_override;
    }

    ScenarioRun run;
    run.scenario = scenario;
#ifdef DARLA_ENABLE_PYTHON_SCRIPTING
    if (options.enable_python_scripts) {
        run.script_runtime = createPythonRuntime();
        run.kernel.setScriptRuntime(run.script_runtime.get());
    }
#endif
    run.kernel.loadScenario(run.scenario);
    configureAgentRuntime(
        run.kernel.world(),
        run.scenario,
        run.relationship_graph,
        run.action_estimator,
        options.enable_realtime_agents,
        options.authorization_mode,
        options.approved_coas);
    while (run.kernel.world().tick < run.scenario.config.max_ticks) {
        run.kernel.step();
        if (!run.has_degradation_snapshot && run.kernel.world().cyber_degradation_applied) {
            run.degradation_snapshot = run.kernel.snapshot();
            run.degradation_snapshot.world.scheduled_interventions.clear();
            run.degradation_snapshot.world.agent_beliefs.commander.primary_decision_recorded = false;
            run.degradation_snapshot.world.realtime_agents_enabled = false;
            run.degradation_snapshot.world.agent_runtime = {};
            run.has_degradation_snapshot = true;
        }
    }

    if (options.enable_realtime_agents && run.has_degradation_snapshot) {
        ScenarioRunOptions baseline_options = options;
        baseline_options.enable_realtime_agents = false;
        const ScenarioRun baseline_reference = runScenarioFile(scenario_path, baseline_options);
        for (const auto& event : run.kernel.events().events()) {
            if (event.label != "online_agent_decision") continue;
            std::string agent_action;
            for (const auto& delta : event.deltas) {
                if (delta.field == "agent.selected_action") agent_action = delta.after;
            }
            AsyncValidationJob job;
            job.queued_at = event.tick;
            job.agent_action = agent_action;
            job.branch_snapshot = run.degradation_snapshot;
            job.baseline = run.action_estimator.projectBaseline(run.degradation_snapshot, run.scenario.config.max_ticks);
            job.horizon_ticks = run.scenario.config.max_ticks;
            run.async_validation.queueAgentDecision(job);
            run.async_summary = run.async_validation.processAll(
                run.kernel.world().runtime_budgets,
                run.kernel.events(),
                baseline_reference.kernel.events(),
                baseline_reference.kernel.world(),
                run.scenario.planted_causal_truth);
            run.has_async_summary = true;
            break;
        }
    }

    return run;
}

ScenarioRun runScenarioFile(
    const std::filesystem::path& scenario_path,
    std::optional<std::uint64_t> seed_override,
    bool enable_realtime_agents) {
    ScenarioRunOptions options;
    options.seed_override = seed_override;
    options.enable_realtime_agents = enable_realtime_agents;
    return runScenarioFile(scenario_path, options);
}

ScenarioRunOptions parseScenarioRunOptions(int argc, char** argv, int start_index) {
    ScenarioRunOptions options;
    options.enable_realtime_agents = true;
    for (int i = start_index; i < argc; ++i) {
        const std::string arg = argv[i];
        if (arg == "--seed" && i + 1 < argc) {
            options.seed_override = std::stoull(argv[++i]);
        } else if (arg == "--mode" && i + 1 < argc) {
            options.authorization_mode = authorizationModeFromString(argv[++i]);
        } else if (arg == "--approve" && i + 1 < argc) {
            ApprovedCoa approved;
            if (!parseApprovedCoa(argv[++i], &approved)) {
                throw std::invalid_argument("invalid --approve token: " + std::string(argv[i]));
            }
            options.approved_coas.push_back(approved);
        }
    }
    return options;
}

} // namespace darla
