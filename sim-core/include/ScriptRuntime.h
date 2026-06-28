#pragma once

#include "ScriptComponent.h"
#include "Types.h"
#include "sim-events/SimEvent.h"

namespace darla {

struct Scenario;
class SimulationKernel;

class ScriptRuntime {
public:
    virtual ~ScriptRuntime() = default;

    virtual void loadScenarioScripts(const Scenario& scenario, SimulationKernel& kernel) = 0;
    virtual void onTick(SimulationKernel& kernel, double dt) = 0;
    virtual void onEvent(SimulationKernel& kernel, const SimEvent& event) = 0;
    virtual void reloadScript(const std::string& script_id, SimulationKernel& kernel) = 0;
};

} // namespace darla
