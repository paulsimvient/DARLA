#pragma once

#include "sim-agents/AgentFramework.h"

namespace darla {

class AgentRuntime {
public:
    AgentRuntime();
    explicit AgentRuntime(AgentOrchestrator orchestrator);

    const AgentOrchestrator& orchestrator() const { return orchestrator_; }
    AgentOrchestrator& orchestrator() { return orchestrator_; }

    void preCyberStep(WorldState& world, EventLedger& ledger, const RelationshipGraph& graph) const;
    void postCyberStep(WorldState& world, EventLedger& ledger, TemporalCausalGraph& graph) const;

private:
    AgentOrchestrator orchestrator_;
};

AgentRuntime& defaultAgentRuntime();

} // namespace darla
