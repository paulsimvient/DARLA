#pragma once

#include "WorldState.h"
#include "sim-events/EventLedger.h"

namespace darla {

class FmuMasterClock {
public:
    static void stepConfiguredFmus(WorldState& world, EventLedger& ledger);
};

} // namespace darla
