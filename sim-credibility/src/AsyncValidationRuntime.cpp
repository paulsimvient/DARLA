#include "sim-credibility/AsyncValidationRuntime.h"

#include "ExecutionBudget.h"
#include "sim-causal/CausalClaimBuilder.h"
#include "sim-causal/PlantedTruthScorer.h"

namespace darla {

void AsyncValidationRuntime::queueAgentDecision(const AsyncValidationJob& job) {
    jobs_.push_back(job);
}

AsyncValidationSummary AsyncValidationRuntime::processAll(
    RuntimeBudgetState& budgets,
    EventLedger& budget_ledger,
    const EventLedger& ledger,
    const WorldState& world,
    const std::vector<PlantedCausalEdge>& planted_truth) {
    AsyncValidationSummary summary;
    if (jobs_.empty()) return summary;
    if (!tryConsumeAsyncReplayJob(budgets, budget_ledger, world.tick, "AsyncValidationRuntime")) {
        summary.falsification_summary = "async replay budget exceeded";
        return summary;
    }

    const auto& job = jobs_.front();
    summary.completed = true;
    summary.agent_action = job.agent_action;

    if (!tryConsumeAsyncBranch(budgets, budget_ledger, world.tick, "CredibilityEngine")) {
        summary.falsification_summary = "async branch budget exceeded before credibility";
        return summary;
    }

    const auto claims = CausalClaimBuilder::build(ledger, world);
    CredibilityEngine credibility;
    const auto assessments = credibility.assessClaims(
        claims,
        ledger,
        job.branch_snapshot,
        job.baseline,
        job.horizon_ticks);

    for (const auto& assessment : assessments) {
        if (assessment.claim.label == "sensor_confidence_loss -> delayed_detection") {
            summary.falsification_survived = assessment.falsification.survived;
            summary.falsification_summary = assessment.falsification.summary;
            break;
        }
    }

    if (!tryConsumeAsyncBranch(budgets, budget_ledger, world.tick, "MinimumInterventionSearch")) {
        summary.falsification_summary = "async branch budget exceeded before intervention search";
        return summary;
    }

    MinimumInterventionSearch search;
    const auto search_result = search.run(job.branch_snapshot, job.baseline, job.horizon_ticks);
    summary.lowest_cost_intervention = describeInterventionSet(search_result.lowest_cost_effective.options);
    summary.best_effect_intervention = describeInterventionSet(search_result.best_effective.options);

    PlantedTruthScorer scorer;
    const auto planted_score = scorer.score(planted_truth, claims);
    summary.planted_truth_recovery = planted_score.recovery_score;
    summary.matched_planted_edges = planted_score.matched_edges;
    summary.missing_planted_edges = planted_score.missing_edges;
    return summary;
}

} // namespace darla
