#include "sim-fmi/FmiMaster.h"

namespace darla {

bool FmiMaster::doStep(FmuComponent& component, double current_time) {
#if defined(DARLA_HAS_FMIL)
    // FMIL master path: setReal on bound inputs, fmi2_do_step, read outputs into component.
    // Falls through to analytical model until FMIL instance wiring is completed.
#endif
    const double before = component.lastStepTime();
    component.step(current_time);
    return component.lastStepTime() > before;
}

} // namespace darla
