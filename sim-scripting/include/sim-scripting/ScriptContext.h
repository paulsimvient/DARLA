#pragma once

#include "ScriptComponent.h"
#include "SimulationKernel.h"

#include <pybind11/pybind11.h>

#include <string>

namespace darla {

class ScriptContext {
public:
    ScriptContext(SimulationKernel& kernel, std::string self_id, std::string script_id);

    Tick tick() const;
    std::string selfId() const;

    pybind11::object get(const std::string& path) const;
    void set(const std::string& path, pybind11::object value);

    void emitEvent(const std::string& type, const std::string& label, double confidence);
    void proposeCoa(
        const std::string& action,
        const std::string& target,
        double expected_mission_gain,
        double causal_confidence,
        double cost,
        double risk,
        const std::string& rationale);
    void scheduleAction(const std::string& action, const std::string& target, Tick at_tick);
    void log(const std::string& message);

private:
    std::string resolveSelfPath(const std::string& path) const;

    SimulationKernel& kernel_;
    std::string self_id_;
    std::string script_id_;
};

} // namespace darla
