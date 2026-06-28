#pragma once

#include "Types.h"

#include <string>

namespace darla {

enum class DecisionHorizon {
    Short,
    Medium,
    Full
};

Tick horizonTicksFor(DecisionHorizon horizon, Tick current_tick, Tick scenario_max_ticks);
std::string toString(DecisionHorizon horizon);

} // namespace darla
