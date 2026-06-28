#include "sim-scripting/PythonScriptComponent.h"

#include "sim-scripting/ScriptContext.h"

#include <algorithm>
#include <filesystem>
#include <functional>
#include <sstream>
#include <stdexcept>
#include <utility>

namespace py = pybind11;

namespace darla {
namespace {

py::object paramValue(const std::string& value) {
    if (value == "true" || value == "True") return py::bool_(true);
    if (value == "false" || value == "False") return py::bool_(false);
    try {
        std::size_t parsed = 0;
        const double number = std::stod(value, &parsed);
        if (parsed == value.size()) return py::float_(number);
    } catch (...) {
    }
    return py::str(value);
}

std::filesystem::path resolveScriptPath(const std::string& script_path) {
    std::filesystem::path path{script_path};
    if (path.is_absolute()) return path;

    const auto cwd_path = std::filesystem::current_path() / path;
    if (std::filesystem::exists(cwd_path)) return cwd_path;

#ifdef DARLA_SOURCE_DIR
    const auto source_path = std::filesystem::path(DARLA_SOURCE_DIR) / path;
    if (std::filesystem::exists(source_path)) return source_path;
#endif

    return cwd_path;
}

PythonScriptRuntimeState* findRuntimeState(SimulationKernel& kernel, const std::string& script_id) {
    auto& runtime = kernel.world().python_script_runtime;
    auto it = std::find_if(
        runtime.begin(),
        runtime.end(),
        [&](const PythonScriptRuntimeState& state) { return state.script_id == script_id; });
    return it == runtime.end() ? nullptr : &*it;
}

py::dict eventDict(const SimEvent& event) {
    py::dict result;
    result["event_id"] = event.event_id;
    result["tick"] = event.tick;
    result["actor"] = event.actor;
    result["type"] = toString(event.type);
    result["label"] = event.label;
    result["confidence"] = event.confidence;
    result["provenance"] = event.provenance;
    return result;
}

} // namespace

PythonScriptComponent::PythonScriptComponent(PythonScriptConfig config)
    : config_(std::move(config)), script_id_(scriptIdFor(config_)) {}

py::dict PythonScriptComponent::paramsDict() const {
    py::dict params;
    for (const auto& [key, value] : config_.params) {
        params[py::str(key)] = paramValue(value);
    }
    return params;
}

void PythonScriptComponent::recordLoadState(
    SimulationKernel& kernel,
    bool loaded,
    const std::string& status,
    const std::string& error) {
    if (auto* state = findRuntimeState(kernel, script_id_)) {
        state->loaded = loaded;
        state->last_reload_status = status;
        state->last_error = error;
        state->last_tick = kernel.world().tick;
    }
}

void PythonScriptComponent::load(SimulationKernel& kernel) {
    if (!config_.enabled) {
        recordLoadState(kernel, false, "disabled", "");
        return;
    }

    try {
        const auto path = resolveScriptPath(config_.script_path);
        if (!std::filesystem::exists(path)) {
            throw std::runtime_error("script file not found: " + path.string());
        }

        const std::string module_name =
            "darla_script_" + std::to_string(std::hash<std::string>{}(script_id_)) + "_" + std::to_string(++reload_generation_);
        py::module_ importlib = py::module_::import("importlib.util");
        py::module_ sys = py::module_::import("sys");
        sys.attr("path").attr("insert")(0, path.parent_path().string());
        py::object spec = importlib.attr("spec_from_file_location")(module_name, path.string());
        py::object module = importlib.attr("module_from_spec")(spec);
        sys.attr("modules")[module_name.c_str()] = module;
        spec.attr("loader").attr("exec_module")(module);

        py::object cls = module.attr(config_.class_name.c_str());
        instance_ = cls(paramsDict());
        recordLoadState(kernel, true, "ok", "");
    } catch (const py::error_already_set& ex) {
        instance_ = py::none();
        recordLoadState(kernel, false, "error", ex.what());
    } catch (const std::exception& ex) {
        instance_ = py::none();
        recordLoadState(kernel, false, "error", ex.what());
    }
}

void PythonScriptComponent::reload(SimulationKernel& kernel) {
    load(kernel);
    onInit(kernel);
    ScriptCommand command;
    command.script_id = script_id_;
    command.object_id = config_.object_id;
    command.issued_at_tick = kernel.world().tick;
    command.type = ScriptCommandType::EmitEvent;
    command.action = "script_reload";
    command.label = "Python script reloaded: " + config_.class_name;
    command.confidence = 1.0;
    std::string error;
    kernel.applyScriptCommand(command, &error);
}

void PythonScriptComponent::onInit(SimulationKernel& kernel) {
    if (!config_.enabled || instance_.is_none() || !py::hasattr(instance_, "on_init")) return;
    ScriptContext ctx{kernel, config_.object_id, script_id_};
    try {
        instance_.attr("on_init")(py::cast(&ctx, py::return_value_policy::reference));
    } catch (const py::error_already_set& ex) {
        recordLoadState(kernel, true, "hook_error", ex.what());
    } catch (const std::exception& ex) {
        recordLoadState(kernel, true, "hook_error", ex.what());
    }
}

void PythonScriptComponent::onTick(SimulationKernel& kernel, double dt) {
    if (!config_.enabled || instance_.is_none() || !py::hasattr(instance_, "on_tick")) return;
    ScriptContext ctx{kernel, config_.object_id, script_id_};
    try {
        instance_.attr("on_tick")(py::cast(&ctx, py::return_value_policy::reference), dt);
    } catch (const py::error_already_set& ex) {
        recordLoadState(kernel, true, "hook_error", ex.what());
    } catch (const std::exception& ex) {
        recordLoadState(kernel, true, "hook_error", ex.what());
    }
}

void PythonScriptComponent::onEvent(SimulationKernel& kernel, const SimEvent& event) {
    if (!config_.enabled || instance_.is_none() || !py::hasattr(instance_, "on_event")) return;
    ScriptContext ctx{kernel, config_.object_id, script_id_};
    try {
        instance_.attr("on_event")(py::cast(&ctx, py::return_value_policy::reference), eventDict(event));
    } catch (const py::error_already_set& ex) {
        recordLoadState(kernel, true, "hook_error", ex.what());
    } catch (const std::exception& ex) {
        recordLoadState(kernel, true, "hook_error", ex.what());
    }
}

} // namespace darla
