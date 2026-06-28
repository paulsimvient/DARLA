#pragma once

#include "ActionType.h"
#include "Types.h"
#include "WorldState.h"

#include <string>
#include <vector>

namespace darla {

struct Snapshot;

struct ActionEffectEstimate {
    double expected_mission_gain = 0.0;
    double causal_confidence = 0.0;
    double cost = 0.0;
    double risk = 0.0;
    double uncertainty_penalty = 0.0;
    bool supported = false;
    std::vector<std::string> causal_path;
    std::string rationale;
};

class ActionEffectEstimator {
public:
    virtual ~ActionEffectEstimator() = default;
    virtual ActionEffectEstimate estimate(
        const Snapshot& snapshot,
        const MissionMetrics& baseline,
        ActionType action,
        EntityId actor,
        const std::vector<EntityId>& targets,
        Tick at_tick,
        Tick horizon_ticks) const = 0;

    virtual MissionMetrics projectBaseline(const Snapshot& snapshot, Tick horizon_ticks) const = 0;
};

} // namespace darla
