#include "sim-agents/AgentRuntime.h"

namespace darla {

AgentRuntime::AgentRuntime()
    : orchestrator_(createMaritimeAgentOrchestrator()) {}

AgentRuntime::AgentRuntime(AgentOrchestrator orchestrator)
    : orchestrator_(std::move(orchestrator)) {}

void AgentRuntime::preCyberStep(WorldState& world, EventLedger& ledger, const RelationshipGraph& graph) const {
    if (!world.realtime_agents_enabled || !world.agent_runtime.relationships) {
        return;
    }
    AgentContext ctx{world, ledger, nullptr, world.agent_runtime.relationships, world.agent_runtime.estimator};
    orchestrator_.runPreCyber(ctx);
}

void AgentRuntime::postCyberStep(WorldState& world, EventLedger& ledger, TemporalCausalGraph& graph) const {
    if (!world.realtime_agents_enabled || !world.agent_runtime.estimator || !world.agent_runtime.relationships) {
        return;
    }
    AgentContext ctx{world, ledger, &graph, world.agent_runtime.relationships, world.agent_runtime.estimator};
    orchestrator_.runPostCyber(ctx);
}

AgentRuntime& defaultAgentRuntime() {
    static AgentRuntime runtime;
    return runtime;
}

} // namespace darla
