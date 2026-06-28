#pragma once

#include "FmuConfig.h"
#include "WorldState.h"

namespace darla {

class FmuBinding {
public:
    static bool readWorldValue(const WorldState& world, const std::string& world_path, double* out);
    static bool writeWorldValue(WorldState& world, const std::string& world_path, double value);
};

} // namespace darla
