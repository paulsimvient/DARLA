#pragma once

#include "FmuComponent.h"
#include "WorldState.h"
#include "sim-events/EventLedger.h"
#include "sim-events/SimEvent.h"

#include <string>
#include <vector>

namespace darla {

class FmuEventAdapter {
public:
    static void emitStepEvent(
        EventLedger& ledger,
        Tick tick,
        const FmuComponent& component,
        const std::vector<StateDelta>& deltas,
        const std::string& summary);
};

} // namespace darla
