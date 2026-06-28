#pragma once

#include "AgentAction.h"
#include "WorldState.h"
#include "sim-events/EventLedger.h"
#include "sim-graph/RelationshipGraph.h"
#include "sim-graph/TemporalCausalGraph.h"

#include <memory>
#include <string>
#include <vector>

namespace darla {

enum class AgentPhase {
    PreCyber,
    PostCyber
};

enum class AgentAuthority {
    Observe,
    Recommend,
    Act
};

struct AgentContext {
    WorldState& world;
    EventLedger& ledger;
    TemporalCausalGraph* causal_graph = nullptr;
    const RelationshipGraph* relationships = nullptr;
    const ActionEffectEstimator* estimator = nullptr;
};

struct AgentTickResult {
    bool sensed = false;
    bool monitoring_emitted = false;
    bool anomaly_detected = false;
    bool action_proposed = false;
    bool action_applied = false;
    std::string summary;
};

class SimulationAgent {
public:
    virtual ~SimulationAgent() = default;

    virtual std::string id() const = 0;
    virtual std::string displayName() const = 0;
    virtual AgentPhase phase() const = 0;
    virtual AgentAuthority authority() const = 0;
    virtual int priority() const = 0;

    virtual bool enabled(const AgentContext& ctx) const;
    virtual AgentTickResult tick(AgentContext& ctx) = 0;
};

class AgentRegistry {
public:
    void registerAgent(std::unique_ptr<SimulationAgent> agent);
    std::vector<AgentTickResult> runPhase(AgentPhase phase, AgentContext& ctx) const;
    const std::vector<std::unique_ptr<SimulationAgent>>& agents() const { return agents_; }
    std::size_t size() const { return agents_.size(); }

private:
    std::vector<std::unique_ptr<SimulationAgent>> agents_;
};

class AgentOrchestrator {
public:
    AgentOrchestrator();
    explicit AgentOrchestrator(AgentRegistry registry);

    const AgentRegistry& registry() const { return registry_; }
    AgentRegistry& registry() { return registry_; }

    std::vector<AgentTickResult> runPreCyber(AgentContext& ctx) const;
    std::vector<AgentTickResult> runPostCyber(AgentContext& ctx) const;

private:
    AgentRegistry registry_;
};

void registerMaritimeMicroWorldAgents(AgentRegistry& registry);

AgentOrchestrator createMaritimeAgentOrchestrator();

} // namespace darla
