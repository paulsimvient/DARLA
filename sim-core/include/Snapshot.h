#pragma once

#include "WorldState.h"
#include "sim-events/EventLedger.h"
#include "sim-graph/TemporalCausalGraph.h"

namespace darla {

struct Snapshot {
    WorldState world;
    EventLedger ledger;
    TemporalCausalGraph causal_graph;
};

} // namespace darla
