#pragma once

#include "Components.h"
#include "ScriptComponent.h"
#include "Types.h"

#include <optional>
#include <string>
#include <vector>

namespace darla {

enum class EntityKind {
    Unit,
    Platform,
    Sensor,
    Weapon,
    NetworkNode,
    LogisticsNode,
    Commander,
    CyberService,
    CivilianInfrastructure,
    TerrainFeature,
    MissionObjective
};

struct Entity {
    EntityId id = 0;
    std::string name;
    EntityKind kind = EntityKind::Unit;
    std::string side;
    std::optional<KinematicState> kinematic;
    std::optional<SensorState> sensor;
    std::optional<CommsState> comms;
    std::optional<CyberState> cyber;
    std::optional<MissionState> mission;
    std::vector<PythonScriptConfig> python_scripts;
};

EntityKind entityKindFromString(const std::string& value);
std::string toString(EntityKind kind);

} // namespace darla
