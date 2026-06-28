#pragma once

#include "ScriptComponent.h"
#include "SimulationKernel.h"

#include <pybind11/pybind11.h>

namespace darla {

class PythonScriptComponent {
public:
    explicit PythonScriptComponent(PythonScriptConfig config);

    void load(SimulationKernel& kernel);
    void reload(SimulationKernel& kernel);

    void onInit(SimulationKernel& kernel);
    void onTick(SimulationKernel& kernel, double dt);
    void onEvent(SimulationKernel& kernel, const SimEvent& event);

    const std::string& objectId() const { return config_.object_id; }
    const std::string& scriptPath() const { return config_.script_path; }
    const std::string& scriptId() const { return script_id_; }
    bool enabled() const { return config_.enabled; }

private:
    void recordLoadState(SimulationKernel& kernel, bool loaded, const std::string& status, const std::string& error);
    pybind11::dict paramsDict() const;

    PythonScriptConfig config_;
    std::string script_id_;
    pybind11::object instance_;
    std::size_t reload_generation_ = 0;
};

} // namespace darla
