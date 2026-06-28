#include "sim-agents/AgentFramework.h"

#include "ExecutionBudget.h"

#include <algorithm>
#include <stdexcept>

namespace darla {

bool SimulationAgent::enabled(const AgentContext& ctx) const {
    return ctx.world.realtime_agents_enabled;
}

void AgentRegistry::registerAgent(std::unique_ptr<SimulationAgent> agent) {
    if (!agent) {
        throw std::invalid_argument("cannot register null agent");
    }
    agents_.push_back(std::move(agent));
    std::stable_sort(agents_.begin(), agents_.end(), [](const auto& lhs, const auto& rhs) {
        if (lhs->phase() != rhs->phase()) {
            return lhs->phase() == AgentPhase::PreCyber;
        }
        return lhs->priority() < rhs->priority();
    });
}

std::vector<AgentTickResult> AgentRegistry::runPhase(AgentPhase phase, AgentContext& ctx) const {
    std::vector<AgentTickResult> results;
    for (const auto& agent : agents_) {
        if (agent->phase() != phase || !agent->enabled(ctx)) {
            continue;
        }
        if (phase == AgentPhase::PostCyber && (!ctx.relationships || !ctx.estimator)) {
            continue;
        }
        if (phase == AgentPhase::PreCyber && !ctx.relationships) {
            continue;
        }
        if (!tryConsumeAgentDecision(ctx.world, ctx.ledger, agent->displayName())) {
            break;
        }
        results.push_back(agent->tick(ctx));
    }
    return results;
}

AgentOrchestrator::AgentOrchestrator() {
    registerMaritimeMicroWorldAgents(registry_);
}

AgentOrchestrator::AgentOrchestrator(AgentRegistry registry)
    : registry_(std::move(registry)) {}

std::vector<AgentTickResult> AgentOrchestrator::runPreCyber(AgentContext& ctx) const {
    return registry_.runPhase(AgentPhase::PreCyber, ctx);
}

std::vector<AgentTickResult> AgentOrchestrator::runPostCyber(AgentContext& ctx) const {
    return registry_.runPhase(AgentPhase::PostCyber, ctx);
}

} // namespace darla
