#include "sim-fmi/FmuEventAdapter.h"

namespace darla {

void FmuEventAdapter::emitStepEvent(
    EventLedger& ledger,
    Tick tick,
    const FmuComponent& component,
    const std::vector<StateDelta>& deltas,
    const std::string& summary) {
    ledger.append(SimEvent{
        0,
        tick,
        0,
        EventType::Observe,
        {},
        deltas,
        {},
        {"fmi-co-sim-v1"},
        1.0,
        0.0,
        0.0,
        summary,
        "fmi co-simulation",
        "fmu_step:" + component.config().id});
}

} // namespace darla
