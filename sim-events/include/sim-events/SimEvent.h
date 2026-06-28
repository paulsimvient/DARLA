#pragma once

#include "Types.h"

#include <string>
#include <vector>

namespace darla {

enum class EventType {
    Observe,
    Move,
    Detect,
    Communicate,
    DecideCOA,
    Engage,
    Jam,
    CyberDegrade,
    Repair,
    Resupply,
    LogisticsDelay,
    PolicyChangeProposed,
    PolicyChangeAccepted,
    MissionEffect,
    EmergentBehaviorDetected,
    InterventionApplied,
    SensorConfidenceLoss,
    HumanApprovedCoa,
    HumanRejectedCoa,
    ManualIntervention
};

struct StateDelta {
    std::string field;
    std::string before;
    std::string after;
};

struct SimEvent {
    EventId event_id = 0;
    Tick tick = 0;
    EntityId actor = 0;
    EventType type = EventType::Observe;
    std::vector<EntityId> targets;
    std::vector<StateDelta> deltas;
    std::vector<EventId> causal_parent_events;
    std::vector<std::string> model_ids;
    double confidence = 1.0;
    double aleatory_uncertainty = 0.0;
    double epistemic_uncertainty = 0.0;
    std::string provenance;
    std::string validity_context;
    std::string label;
};

std::string toString(EventType type);

} // namespace darla
