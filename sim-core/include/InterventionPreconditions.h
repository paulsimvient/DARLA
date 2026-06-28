#pragma once

#include "WorldState.h"
#include "sim-events/SimEvent.h"

#include <string>
#include <vector>

namespace darla {

struct InterventionPrecondition {
    bool applies = false;
    std::string reason;
    std::string audit_label;
};

struct InterventionApplicationResult {
    bool scheduled = false;
    bool operational = false;
    std::string audit_label;
    std::vector<StateDelta> deltas;
};

bool sensorDegradationIsCausal(const WorldState& world, const Entity& entity);
bool commsDegradationIsCausal(const WorldState& world, const Entity& entity);

InterventionPrecondition evaluateInterventionPrecondition(
    const WorldState& world,
    const std::string& intervention_type,
    const Entity* target);

InterventionApplicationResult applyInterventionEffect(
    WorldState& world,
    const std::string& intervention_type,
    Entity& target);

} // namespace darla
