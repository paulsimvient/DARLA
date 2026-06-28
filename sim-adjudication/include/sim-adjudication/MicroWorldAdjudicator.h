#pragma once

#include "WorldState.h"
#include "sim-events/EventLedger.h"
#include "sim-graph/TemporalCausalGraph.h"

namespace darla {

class MicroWorldAdjudicator {
public:
    void adjudicate(WorldState& world, EventLedger& ledger, TemporalCausalGraph& graph) const;

private:
    void maybeApplyScheduledInterventions(WorldState& world, EventLedger& ledger) const;
    void maybeRecordLogisticsDelay(WorldState& world, EventLedger& ledger) const;
    void maybeApplyCyberDegradation(WorldState& world, EventLedger& ledger, TemporalCausalGraph& graph) const;
    void maybeRecordDetection(WorldState& world, EventLedger& ledger, TemporalCausalGraph& graph) const;
    void maybeRecordCoaAndMission(WorldState& world, EventLedger& ledger, TemporalCausalGraph& graph) const;
    void maybeRecordEmergence(WorldState& world, EventLedger& ledger, TemporalCausalGraph& graph) const;
};

} // namespace darla
