#pragma once

#include "Types.h"

#include <string>

namespace darla {

struct EventLedger;
struct WorldState;

struct ExecutionBudgetLimits {
    int agent_decisions_per_tick = 16;
    int causal_queries_per_tick = 12;
    int kernel_tick_budget_ms = 0;
    int async_replay_jobs = 2;
    int async_branch_executions = 24;
};

struct ExecutionBudgetUsage {
    int agent_decisions = 0;
    int causal_queries = 0;
    int async_replay_jobs = 0;
    int async_branch_executions = 0;
};

struct RuntimeBudgetState {
    ExecutionBudgetLimits limits;
    ExecutionBudgetUsage tick_usage;
    ExecutionBudgetUsage total_usage;
};

void resetTickBudgetUsage(RuntimeBudgetState& budgets);
bool tryConsumeAgentDecision(WorldState& world, EventLedger& ledger, const std::string& consumer);
bool tryConsumeCausalQuery(WorldState& world, EventLedger& ledger, const std::string& consumer);
bool tryConsumeAsyncReplayJob(RuntimeBudgetState& budgets, EventLedger& ledger, Tick tick, const std::string& consumer);
bool tryConsumeAsyncBranch(RuntimeBudgetState& budgets, EventLedger& ledger, Tick tick, const std::string& consumer);

} // namespace darla
