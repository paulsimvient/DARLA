#include "sim-scripting/PythonRuntime.h"

#include "Entity.h"
#include "ScenarioLoader.h"
#include "sim-scripting/ScriptContext.h"

#include <pybind11/embed.h>

#include <algorithm>
#include <memory>

namespace py = pybind11;

PYBIND11_EMBEDDED_MODULE(darla, m) {
    py::class_<darla::ScriptContext>(m, "Context")
        .def("tick", &darla::ScriptContext::tick)
        .def("self_id", &darla::ScriptContext::selfId)
        .def("get", &darla::ScriptContext::get, py::arg("path"))
        .def("set", &darla::ScriptContext::set, py::arg("path"), py::arg("value"))
        .def("emit_event", &darla::ScriptContext::emitEvent, py::arg("type"), py::arg("label"), py::arg("confidence") = 1.0)
        .def(
            "propose_coa",
            &darla::ScriptContext::proposeCoa,
            py::arg("action"),
            py::arg("target"),
            py::arg("expected_mission_gain"),
            py::arg("causal_confidence"),
            py::arg("cost"),
            py::arg("risk"),
            py::arg("rationale"))
        .def("schedule_action", &darla::ScriptContext::scheduleAction, py::arg("action"), py::arg("target"), py::arg("at_tick"))
        .def("log", &darla::ScriptContext::log, py::arg("message"));
}

namespace darla {
namespace {

void ensurePythonInterpreter() {
    static const bool initialized = [] {
        py::initialize_interpreter();
        return true;
    }();
    (void)initialized;
}

PythonScriptComponent* findComponent(std::vector<PythonScriptComponent>& components, const std::string& script_id) {
    auto it = std::find_if(
        components.begin(),
        components.end(),
        [&](const PythonScriptComponent& component) { return component.scriptId() == script_id; });
    return it == components.end() ? nullptr : &*it;
}

} // namespace

PythonRuntime::PythonRuntime() {
    ensurePythonInterpreter();
    py::gil_scoped_acquire gil;
    py::module_::import("darla");
}

PythonRuntime::~PythonRuntime() = default;

void PythonRuntime::loadScenarioScripts(const Scenario& scenario, SimulationKernel& kernel) {
    py::gil_scoped_acquire gil;
    components_.clear();
    for (const auto& entity : scenario.entities) {
        for (const auto& config : entity.python_scripts) {
            components_.emplace_back(config);
            components_.back().load(kernel);
            components_.back().onInit(kernel);
        }
    }
}

void PythonRuntime::onTick(SimulationKernel& kernel, double dt) {
    py::gil_scoped_acquire gil;
    for (auto& component : components_) {
        component.onTick(kernel, dt);
    }
}

void PythonRuntime::onEvent(SimulationKernel& kernel, const SimEvent& event) {
    py::gil_scoped_acquire gil;
    for (auto& component : components_) {
        component.onEvent(kernel, event);
    }
}

void PythonRuntime::reloadScript(const std::string& script_id, SimulationKernel& kernel) {
    py::gil_scoped_acquire gil;
    if (auto* component = findComponent(components_, script_id)) {
        component->reload(kernel);
    }
}

std::unique_ptr<ScriptRuntime> createPythonRuntime() {
    return std::make_unique<PythonRuntime>();
}

} // namespace darla
