#pragma once

#include "ScriptRuntime.h"
#include "sim-scripting/PythonScriptComponent.h"

#include <memory>
#include <string>
#include <vector>

namespace darla {

class PythonRuntime final : public ScriptRuntime {
public:
    PythonRuntime();
    ~PythonRuntime() override;

    void loadScenarioScripts(const Scenario& scenario, SimulationKernel& kernel) override;
    void onTick(SimulationKernel& kernel, double dt) override;
    void onEvent(SimulationKernel& kernel, const SimEvent& event) override;
    void reloadScript(const std::string& script_id, SimulationKernel& kernel) override;

private:
    std::vector<PythonScriptComponent> components_;
};

std::unique_ptr<ScriptRuntime> createPythonRuntime();

} // namespace darla
