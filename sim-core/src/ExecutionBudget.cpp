#include "ExecutionBudget.h"

#include "WorldState.h"
#include "sim-events/EventLedger.h"

namespace darla {
namespace {

void emitBudgetExceeded(EventLedger& ledger, Tick tick, const std::string& budget_type, const std::string& consumer) {
    ledger.append(SimEvent{
        0,
        tick,
        0,
        EventType::EmergentBehaviorDetected,
        {},
        {{"budget.type", "none", budget_type}, {"budget.consumer", "none", consumer}},
        {},
        {"runtime-budget-v1"},
        1.0,
        0.0,
        0.0,
        "execution budget exceeded",
        "maritime ISR cyber/comms scenario",
        "budget_exceeded"});
}

} // namespace

void resetTickBudgetUsage(RuntimeBudgetState& budgets) {
    budgets.tick_usage = {};
}

bool tryConsumeAgentDecision(WorldState& world, EventLedger& ledger, const std::string& consumer) {
    if (world.runtime_budgets.tick_usage.agent_decisions >= world.runtime_budgets.limits.agent_decisions_per_tick) {
        emitBudgetExceeded(ledger, world.tick, "agent_decision", consumer);
        return false;
    }
    ++world.runtime_budgets.tick_usage.agent_decisions;
    ++world.runtime_budgets.total_usage.agent_decisions;
    return true;
}

bool tryConsumeCausalQuery(WorldState& world, EventLedger& ledger, const std::string& consumer) {
    if (world.runtime_budgets.tick_usage.causal_queries >= world.runtime_budgets.limits.causal_queries_per_tick) {
        emitBudgetExceeded(ledger, world.tick, "causal_query", consumer);
        return false;
    }
    ++world.runtime_budgets.tick_usage.causal_queries;
    ++world.runtime_budgets.total_usage.causal_queries;
    return true;
}

bool tryConsumeAsyncReplayJob(RuntimeBudgetState& budgets, EventLedger& ledger, Tick tick, const std::string& consumer) {
    if (budgets.tick_usage.async_replay_jobs >= budgets.limits.async_replay_jobs) {
        emitBudgetExceeded(ledger, tick, "async_replay_job", consumer);
        return false;
    }
    ++budgets.tick_usage.async_replay_jobs;
    ++budgets.total_usage.async_replay_jobs;
    return true;
}

bool tryConsumeAsyncBranch(RuntimeBudgetState& budgets, EventLedger& ledger, Tick tick, const std::string& consumer) {
    if (budgets.tick_usage.async_branch_executions >= budgets.limits.async_branch_executions) {
        emitBudgetExceeded(ledger, tick, "async_branch_execution", consumer);
        return false;
    }
    ++budgets.tick_usage.async_branch_executions;
    ++budgets.total_usage.async_branch_executions;
    return true;
}

} // namespace darla
