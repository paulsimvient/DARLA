#include "sim-scripting/ScriptContext.h"

#include <stdexcept>
#include <string_view>
#include <utility>

namespace py = pybind11;

namespace darla {

ScriptContext::ScriptContext(SimulationKernel& kernel, std::string self_id, std::string script_id)
    : kernel_(kernel), self_id_(std::move(self_id)), script_id_(std::move(script_id)) {}

Tick ScriptContext::tick() const {
    return kernel_.world().tick;
}

std::string ScriptContext::selfId() const {
    return self_id_;
}

std::string ScriptContext::resolveSelfPath(const std::string& path) const {
    if (path == "self") return self_id_;
    constexpr std::string_view prefix = "self.";
    if (path.rfind(prefix, 0) == 0) {
        return self_id_ + "." + path.substr(prefix.size());
    }
    return path;
}

py::object ScriptContext::get(const std::string& path) const {
    const std::string resolved = resolveSelfPath(path);
    if (resolved == "tick") return py::int_(kernel_.world().tick);
    if (resolved == "mission.success_score") return py::float_(kernel_.world().metrics.mission_success_score);
    if (resolved == "mission.target_detected") return py::bool_(kernel_.world().metrics.target_detected);

    const auto first_dot = resolved.find('.');
    if (first_dot == std::string::npos) return py::none();

    const std::string entity_name = resolved.substr(0, first_dot);
    const std::string component_path = resolved.substr(first_dot + 1);
    const auto* entity = kernel_.world().entityByName(entity_name);
    if (!entity) return py::none();

    if (component_path == "sensor.confidence" && entity->sensor) return py::float_(entity->sensor->confidence);
    if (component_path == "sensor.range_km" && entity->sensor) return py::float_(entity->sensor->range_km);
    if (component_path == "sensor.latency_sec" && entity->sensor) return py::float_(entity->sensor->latency_sec);
    if (component_path == "sensor.degraded" && entity->sensor) return py::bool_(entity->sensor->degraded);
    if (component_path == "sensor.isolated" && entity->sensor) return py::bool_(entity->sensor->isolated);

    if (component_path == "comms.health" && entity->comms) return py::float_(1.0 - entity->comms->packet_loss);
    if (component_path == "comms.packet_loss" && entity->comms) return py::float_(entity->comms->packet_loss);
    if (component_path == "comms.latency_sec" && entity->comms) return py::float_(entity->comms->latency_sec);
    if (component_path == "comms.bandwidth_mbps" && entity->comms) return py::float_(entity->comms->bandwidth_mbps);
    if (component_path == "comms.jammed" && entity->comms) return py::bool_(entity->comms->jammed);
    if (component_path == "comms.compromised" && entity->comms) return py::bool_(entity->comms->compromised);

    if (component_path == "cyber.integrity" && entity->cyber) return py::float_(entity->cyber->integrity);
    if (component_path == "cyber.compromise_probability" && entity->cyber) return py::float_(entity->cyber->compromise_probability);
    if (component_path == "cyber.lateral_movement_risk" && entity->cyber) return py::float_(entity->cyber->lateral_movement_risk);
    if (component_path == "cyber.isolated" && entity->cyber) return py::bool_(entity->cyber->isolated);

    if (component_path == "mission.progress" && entity->mission) return py::float_(entity->mission->progress);
    if (component_path == "mission.confidence" && entity->mission) return py::float_(entity->mission->confidence);
    if (component_path == "mission.mission_effectiveness" && entity->mission) return py::float_(entity->mission->mission_effectiveness);
    if (component_path == "mission.current_task" && entity->mission) return py::str(entity->mission->current_task);

    return py::none();
}

void ScriptContext::set(const std::string&, py::object) {
    throw std::runtime_error("ctx.set is disabled; emit events, propose COAs, or schedule actions instead");
}

void ScriptContext::emitEvent(const std::string& type, const std::string& label, double confidence) {
    ScriptCommand command;
    command.script_id = script_id_;
    command.object_id = self_id_;
    command.issued_at_tick = kernel_.world().tick;
    command.type = ScriptCommandType::EmitEvent;
    command.action = type;
    command.label = label;
    command.confidence = confidence;
    std::string error;
    if (!kernel_.applyScriptCommand(command, &error)) {
        throw std::runtime_error(error);
    }
}

void ScriptContext::proposeCoa(
    const std::string& action,
    const std::string& target,
    double expected_mission_gain,
    double causal_confidence,
    double cost,
    double risk,
    const std::string& rationale) {
    ScriptCommand command;
    command.script_id = script_id_;
    command.object_id = self_id_;
    command.issued_at_tick = kernel_.world().tick;
    command.type = ScriptCommandType::ProposeCoa;
    command.action = action;
    command.target = target;
    command.expected_mission_gain = expected_mission_gain;
    command.causal_confidence = causal_confidence;
    command.cost = cost;
    command.risk = risk;
    command.rationale = rationale;
    std::string error;
    if (!kernel_.applyScriptCommand(command, &error)) {
        throw std::runtime_error(error);
    }
}

void ScriptContext::scheduleAction(const std::string& action, const std::string& target, Tick at_tick) {
    ScriptCommand command;
    command.script_id = script_id_;
    command.object_id = self_id_;
    command.issued_at_tick = kernel_.world().tick;
    command.type = ScriptCommandType::ScheduleAction;
    command.action = action;
    command.target = target;
    command.at_tick = at_tick;
    std::string error;
    if (!kernel_.applyScriptCommand(command, &error)) {
        throw std::runtime_error(error);
    }
}

void ScriptContext::log(const std::string& message) {
    ScriptCommand command;
    command.script_id = script_id_;
    command.object_id = self_id_;
    command.issued_at_tick = kernel_.world().tick;
    command.type = ScriptCommandType::Log;
    command.label = message;
    std::string error;
    if (!kernel_.applyScriptCommand(command, &error)) {
        throw std::runtime_error(error);
    }
}

} // namespace darla
