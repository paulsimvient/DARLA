#pragma once

#include "AgentAction.h"
#include "Snapshot.h"
#include "WorldState.h"
#include "sim-events/EventLedger.h"
#include "sim-graph/RelationshipGraph.h"
#include "sim-graph/TemporalCausalGraph.h"

#include <string>
#include <vector>

namespace darla {

struct CandidateAction {
    ActionType type = ActionType::HoldCurrentCOA;
    EntityId actor = 0;
    std::vector<EntityId> targets;
    double expectedMissionGain = 0.0;
    double causalConfidence = 0.0;
    double timeUrgency = 0.0;
    double cost = 0.0;
    double risk = 0.0;
    double uncertaintyPenalty = 0.0;
    bool supported = false;
    std::vector<NodeId> expectedCausalPath;
    std::vector<std::string> causal_path;
    std::string structuredRationale;

    double score() const;
};

struct AgentDecision {
    Tick tick = 0;
    std::string agent;
    CandidateAction selected;
    std::vector<CandidateAction> candidates;
};

class RedCyberAgent {
public:
    void step(WorldState& world, EventLedger& ledger, const RelationshipGraph& graph) const;
};

class SensorAgent {
public:
    void step(WorldState& world, EventLedger& ledger) const;
};

class CommsAgent {
public:
    void step(WorldState& world, EventLedger& ledger) const;
};

class BlueUASAgent {
public:
    void step(WorldState& world, EventLedger& ledger) const;
};

class LogisticsAgent {
public:
    void step(WorldState& world, EventLedger& ledger) const;
};

class CausalMonitorAgent {
public:
    void step(WorldState& world, EventLedger& ledger) const;
};

class CredibilityAgent {
public:
    void step(WorldState& world, EventLedger& ledger) const;
};

class BlueCommanderAgent {
public:
    AgentDecision decide(
        WorldState& world,
        EventLedger& ledger,
        const Snapshot& branch_snapshot,
        const RelationshipGraph& graph,
        const ActionEffectEstimator& estimator) const;

    void step(
        WorldState& world,
        EventLedger& ledger,
        const TemporalCausalGraph& graph,
        const RelationshipGraph& relationships,
        const ActionEffectEstimator& estimator) const;
};

} // namespace darla
