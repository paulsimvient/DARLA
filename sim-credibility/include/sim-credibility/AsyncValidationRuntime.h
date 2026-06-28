#pragma once

#include "Snapshot.h"
#include "sim-causal/MinimumInterventionSearch.h"
#include "sim-credibility/CredibilityEngine.h"

#include <string>
#include <vector>

namespace darla {

struct AsyncValidationJob {
    Tick queued_at = 0;
    std::string agent_action;
    Snapshot branch_snapshot;
    MissionMetrics baseline;
    Tick horizon_ticks = 0;
};

struct AsyncValidationSummary {
    bool completed = false;
    std::string agent_action;
    bool falsification_survived = false;
    std::string falsification_summary;
    std::string lowest_cost_intervention;
    std::string best_effect_intervention;
    double planted_truth_recovery = 0.0;
    std::vector<std::string> matched_planted_edges;
    std::vector<std::string> missing_planted_edges;
};

class AsyncValidationRuntime {
public:
    void queueAgentDecision(const AsyncValidationJob& job);
    AsyncValidationSummary processAll(
        RuntimeBudgetState& budgets,
        EventLedger& budget_ledger,
        const EventLedger& ledger,
        const WorldState& world,
        const std::vector<PlantedCausalEdge>& planted_truth);

private:
    std::vector<AsyncValidationJob> jobs_;
};

} // namespace darla
