#include "DecisionHorizon.h"

namespace darla {

Tick horizonTicksFor(DecisionHorizon horizon, Tick current_tick, Tick scenario_max_ticks) {
    switch (horizon) {
    case DecisionHorizon::Short:
        return std::min(scenario_max_ticks, current_tick + 480);
    case DecisionHorizon::Medium:
        return std::min(scenario_max_ticks, current_tick + 1200);
    case DecisionHorizon::Full:
        return scenario_max_ticks;
    }
    return scenario_max_ticks;
}

std::string toString(DecisionHorizon horizon) {
    switch (horizon) {
    case DecisionHorizon::Short: return "short";
    case DecisionHorizon::Medium: return "medium";
    case DecisionHorizon::Full: return "full";
    }
    return "unknown";
}

} // namespace darla
