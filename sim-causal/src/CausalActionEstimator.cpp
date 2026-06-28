#include "sim-causal/CausalActionEstimator.h"

#include "ExecutionBudget.h"
#include "InterventionPreconditions.h"
#include "SimulationKernel.h"
#include "Snapshot.h"

#include <sstream>

namespace darla {
namespace {

struct ActionMetadata {
    double cost = 0.0;
    double risk = 0.0;
};

ActionMetadata metadataFor(ActionType action) {
    switch (action) {
    case ActionType::IsolateCompromisedSensorFeed: return {0.03, 0.05};
    case ActionType::RestoreCommsRelay: return {0.04, 0.04};
    case ActionType::EnableAutonomousSearch: return {0.08, 0.12};
    case ActionType::PreAuthorizeEngagement: return {0.02, 0.18};
    case ActionType::HoldCurrentCOA: return {0.0, 0.30};
    }
    return {0.0, 0.30};
}

Intervention interventionFor(ActionType action, const std::vector<EntityId>& targets, Tick at_tick, const Snapshot& snapshot) {
    auto targetName = [&](EntityId id) -> std::string {
        for (const auto& [entity_id, entity] : snapshot.world.entities) {
            if (entity_id == id) return entity.name;
        }
        return {};
    };

    switch (action) {
    case ActionType::IsolateCompromisedSensorFeed:
        return Intervention{InterventionType::IsolateCompromisedSensorFeed, at_tick, targets.empty() ? "blue_uas_1" : targetName(targets.front())};
    case ActionType::RestoreCommsRelay:
        return Intervention{InterventionType::RestoreCommsRelay, at_tick, targets.empty() ? "blue_relay_1" : targetName(targets.front())};
    case ActionType::EnableAutonomousSearch:
        return Intervention{InterventionType::EnableAutonomousSearch, at_tick, targets.empty() ? "blue_uas_1" : targetName(targets.front())};
    case ActionType::PreAuthorizeEngagement:
        return Intervention{InterventionType::PreAuthorizeEngagement, at_tick, targets.empty() ? "blue_commander" : targetName(targets.front())};
    case ActionType::HoldCurrentCOA:
        return Intervention{InterventionType::IsolateCompromisedSensorFeed, at_tick, "blue_uas_1"};
    }
    return Intervention{};
}

Tick scheduleTickFor(ActionType action, Tick current_tick) {
    switch (action) {
    case ActionType::IsolateCompromisedSensorFeed:
    case ActionType::RestoreCommsRelay:
        return std::max<Tick>(760, current_tick + 1);
    case ActionType::EnableAutonomousSearch:
    case ActionType::PreAuthorizeEngagement:
        return std::max<Tick>(900, current_tick + 1);
    case ActionType::HoldCurrentCOA:
        return current_tick;
    }
    return current_tick + 1;
}

double confidenceFrom(const CounterfactualResult& result) {
    if (result.estimated_effect > 0.15) return 0.82;
    if (result.estimated_effect > 0.05) return 0.62;
    if (result.estimated_effect > 0.0) return 0.45;
    return 0.30;
}

double uncertaintyFrom(const CounterfactualResult& result) {
    if (result.estimated_effect > 0.15) return 0.08;
    if (result.estimated_effect > 0.05) return 0.13;
    return 0.20;
}

std::string rationaleFrom(ActionType action, const CounterfactualResult& result) {
    std::ostringstream out;
    out << "causal runtime estimate: mission delta " << result.estimated_effect
        << ", detection T+" << result.counterfactual.detection_time;
    if (!result.dominant_causal_path.empty()) {
        out << ", path ";
        for (std::size_t i = 0; i < result.dominant_causal_path.size(); ++i) {
            if (i > 0) out << " -> ";
            out << result.dominant_causal_path[i];
        }
    }
    out << " for action " << toString(action);
    return out.str();
}

} // namespace

MissionMetrics CausalActionEstimator::projectBaseline(const Snapshot& snapshot, Tick horizon_ticks) const {
    Snapshot branch_snapshot = snapshot;
    branch_snapshot.world.realtime_agents_enabled = false;
    branch_snapshot.world.agent_runtime = {};
    branch_snapshot.world.agent_beliefs.commander.primary_decision_recorded = false;

    SimulationKernel kernel;
    SimConfig config;
    config.max_ticks = horizon_ticks;
    kernel.initialize(config);
    kernel.restore(branch_snapshot);
    kernel.runUntil(horizon_ticks);
    return kernel.world().metrics;
}

ActionEffectEstimate CausalActionEstimator::estimateInternal(
    const Snapshot& snapshot,
    const MissionMetrics& baseline,
    ActionType action,
    EntityId /*actor*/,
    const std::vector<EntityId>& targets,
    Tick at_tick,
    Tick horizon_ticks) const {
    const auto meta = metadataFor(action);
    ActionEffectEstimate estimate;
    estimate.cost = meta.cost;
    estimate.risk = meta.risk;

    if (action == ActionType::HoldCurrentCOA) {
        estimate.expected_mission_gain = 0.0;
        estimate.causal_confidence = 0.30;
        estimate.uncertainty_penalty = 0.20;
        estimate.supported = true;
        estimate.rationale = "causal runtime estimate: hold preserves current branch with no intervention delta";
        return estimate;
    }

    const Tick scheduled_tick = at_tick > 0 ? at_tick : scheduleTickFor(action, snapshot.world.tick);
    const auto intervention = interventionFor(action, targets, scheduled_tick, snapshot);
    const auto* target_entity = snapshot.world.entityByName(intervention.target);
    const auto precondition = evaluateInterventionPrecondition(
        snapshot.world,
        toString(intervention.type),
        target_entity);
    if (!precondition.applies) {
        estimate.rationale = "precondition failed: " + precondition.reason;
        estimate.supported = false;
        estimate.uncertainty_penalty = 0.20;
        return estimate;
    }

    const auto result = engine_.run(snapshot, baseline, intervention, horizon_ticks);

    estimate.expected_mission_gain = result.estimated_effect;
    estimate.causal_confidence = confidenceFrom(result);
    estimate.uncertainty_penalty = uncertaintyFrom(result);
    estimate.causal_path = result.dominant_causal_path;
    estimate.rationale = rationaleFrom(action, result);
    estimate.supported = result.estimated_effect > 0.05 && estimate.causal_confidence >= 0.45;
    return estimate;
}

ActionEffectEstimate CausalActionEstimator::estimate(
    const Snapshot& snapshot,
    const MissionMetrics& baseline,
    ActionType action,
    EntityId actor,
    const std::vector<EntityId>& targets,
    Tick at_tick,
    Tick horizon_ticks) const {
    const BranchCacheKey key{action, actor, at_tick, horizon_ticks};
    if (const auto cached = branch_cache_.find(key); cached != branch_cache_.end()) {
        return cached->second;
    }
    const auto estimate = estimateInternal(snapshot, baseline, action, actor, targets, at_tick, horizon_ticks);
    branch_cache_[key] = estimate;
    return estimate;
}

ActionEffectEstimate CausalActionEstimator::estimateActionEffect(
    WorldState& world,
    EventLedger& ledger,
    const Snapshot& snapshot,
    const MissionMetrics& baseline,
    ActionType action,
    EntityId actor,
    const std::vector<EntityId>& targets,
    DecisionHorizon horizon) const {
    if (!tryConsumeCausalQuery(world, ledger, "CausalActionEstimator")) {
        ActionEffectEstimate denied;
        denied.supported = false;
        denied.rationale = "causal query budget exceeded";
        denied.uncertainty_penalty = 1.0;
        return denied;
    }

    const Tick at_tick = scheduleTickFor(action, snapshot.world.tick);
    const Tick horizon_ticks = horizonTicksFor(horizon, snapshot.world.tick, world.agent_runtime.horizon_ticks);
    return estimate(snapshot, baseline, action, actor, targets, at_tick, horizon_ticks);
}

void CausalActionEstimator::setBranchCacheEntry(
    ActionType action,
    EntityId actor,
    Tick at_tick,
    Tick horizon_ticks,
    ActionEffectEstimate estimate) const {
    branch_cache_[BranchCacheKey{action, actor, at_tick, horizon_ticks}] = std::move(estimate);
}

} // namespace darla
