#pragma once

#include "FmuComponent.h"

namespace darla {

// Co-simulation master — analytical DoStep today; swap in fmi2DoStep/fmi3DoStep when FMIL is linked.
class FmiMaster {
public:
    static bool doStep(FmuComponent& component, double current_time);
};

} // namespace darla
