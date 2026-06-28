#include "sim-causal/InterventionEngine.h"

#include "sim-causal/CausalClaimBuilder.h"

#include <algorithm>

namespace darla {

std::string toString(ClaimStatus status) {
    switch (status) {
    case ClaimStatus::DirectlyAdjudicated: return "directly adjudicated";
    case ClaimStatus::Identifiable: return "identifiable";
    case ClaimStatus::WeaklyIdentifiable: return "weakly identifiable";
    case ClaimStatus::Confounded: return "confounded";
    case ClaimStatus::NotIdentifiable: return "not identifiable";
    case ClaimStatus::Falsified: return "falsified";
    }
    return "unknown";
}

std::string toString(InterventionType type) {
    switch (type) {
    case InterventionType::IsolateCompromisedSensorFeed: return "isolate_compromised_sensor_feed";
    case InterventionType::RestoreCommsRelay: return "restore_comms_relay";
    case InterventionType::RemoveLogisticsDelay: return "remove_logistics_delay";
    case InterventionType::EnableAutonomousSearch: return "enable_autonomous_search";
    case InterventionType::PreAuthorizeEngagement: return "pre_authorize_engagement";
    }
    return "unknown";
}

CounterfactualResult InterventionEngine::run(const Snapshot& snapshot, const MissionMetrics& baseline, const Intervention& intervention, Tick horizon_ticks) const {
    return run(snapshot, baseline, std::vector<Intervention>{intervention}, horizon_ticks);
}

CounterfactualResult InterventionEngine::run(const Snapshot& snapshot, const MissionMetrics& baseline, const std::vector<Intervention>& interventions, Tick horizon_ticks) const {
    Snapshot branch_snapshot = snapshot;
    branch_snapshot.world.realtime_agents_enabled = false;
    branch_snapshot.world.agent_runtime = {};
    branch_snapshot.world.agent_beliefs.commander.primary_decision_recorded = false;
    for (const auto& intervention : interventions) {
        branch_snapshot.world.scheduled_interventions.push_back(
            ScheduledIntervention{toString(intervention.type), intervention.at_tick, intervention.target, false});
    }

    SimulationKernel kernel;
    kernel.initialize(SimConfig{});
    kernel.restore(branch_snapshot);
    kernel.runUntil(horizon_ticks);

    CounterfactualResult result;
    result.baseline = baseline;
    result.counterfactual = kernel.world().metrics;
    result.estimated_effect = result.counterfactual.mission_success_score - baseline.mission_success_score;
    result.confidence = result.estimated_effect > 0.10 ? "medium-high" : "low";
    result.validity = "maritime ISR cyber/comms scenario only";
    result.dominant_causal_path = kernel.causalGraph().dominantPathLabels();
    result.branch_ledger = kernel.events();
    result.claims = buildClaims(kernel.events(), kernel.world(), &result);
    return result;
}

std::vector<CausalClaim> InterventionEngine::buildClaims(const EventLedger& ledger, const WorldState& world, const CounterfactualResult* result) {
    return CausalClaimBuilder::build(ledger, world, result);
}

} // namespace darla
