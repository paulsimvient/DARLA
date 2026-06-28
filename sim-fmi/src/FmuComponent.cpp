#include "sim-fmi/FmuComponent.h"

#include <algorithm>
#include <cstdlib>
#include <filesystem>
#include <sstream>
#include <utility>

namespace darla {
namespace {

std::filesystem::path resolveFmuPath(const std::string& configured_path) {
    const std::filesystem::path path{configured_path};
    if (path.is_absolute()) {
        return path;
    }
    if (const char* source_dir = std::getenv("DARLA_SOURCE_DIR"); source_dir != nullptr) {
        const auto rooted = std::filesystem::path(source_dir) / path;
        if (std::filesystem::exists(rooted)) {
            return rooted;
        }
    }
    return path;
}

} // namespace

FmuComponent::FmuComponent(FmuComponentConfig config) : config_(std::move(config)) {
    for (const auto& input : config_.inputs) {
        ports_.push_back(FmuPort{input.port, FmuPortDirection::Input, input.world_path});
    }
    for (const auto& output : config_.outputs) {
        ports_.push_back(FmuPort{output.port, FmuPortDirection::Output, output.world_path});
    }
}

std::map<std::string, double> FmuComponent::portMapFromRuntime(
    const std::vector<FmuPortRuntimeValue>& values) {
    std::map<std::string, double> mapped;
    for (const auto& value : values) {
        mapped[value.port] = value.value;
    }
    return mapped;
}

void FmuComponent::portMapToRuntime(
    const std::map<std::string, double>& values,
    std::vector<FmuPortRuntimeValue>* out) {
    out->clear();
    out->reserve(values.size());
    for (const auto& [port, value] : values) {
        out->push_back(FmuPortRuntimeValue{port, value});
    }
}

bool FmuComponent::initialize() {
    input_values_.clear();
    output_values_.clear();

    const auto fmu_path = resolveFmuPath(config_.path);
    fmi_file_present_ = std::filesystem::exists(fmu_path);
    if (fmi_file_present_) {
#if defined(DARLA_HAS_FMIL)
        load_mode_ = "fmi_file";
#else
        load_mode_ = "fmi_file_analytical";
#endif
    } else {
        load_mode_ = "analytical_stub";
    }

    loaded_ = true;
    return true;
}

void FmuComponent::restoreRuntime(const FmuRuntimeState& state) {
    load_mode_ = state.load_mode;
    last_step_time_ = state.last_step_time;
    loaded_ = state.initialized;
    input_values_ = portMapFromRuntime(state.inputs);
    output_values_ = portMapFromRuntime(state.outputs);
}

void FmuComponent::exportRuntime(FmuRuntimeState* state) const {
    state->id = config_.id;
    state->load_mode = load_mode_;
    state->initialized = loaded_;
    state->last_step_time = last_step_time_;
    portMapToRuntime(input_values_, &state->inputs);
    portMapToRuntime(output_values_, &state->outputs);
}

void FmuComponent::setInput(const std::string& port_name, double value) {
    input_values_[port_name] = value;
}

bool FmuComponent::getOutput(const std::string& port_name, double* out) const {
    const auto it = output_values_.find(port_name);
    if (it == output_values_.end()) {
        return false;
    }
    *out = it->second;
    return true;
}

double FmuComponent::inputValueOr(const std::string& port_name, double fallback) const {
    const auto it = input_values_.find(port_name);
    return it == input_values_.end() ? fallback : it->second;
}

void FmuComponent::computeOutputs() {
    for (const auto& output : config_.outputs) {
        double value = 0.0;

        const bool maps_sensor_confidence =
            output.port.find("sensor_confidence") != std::string::npos ||
            output.world_path.find("sensor.confidence") != std::string::npos;
        const bool maps_packet_loss =
            output.port.find("packet_loss") != std::string::npos ||
            output.world_path.find("comms.packet_loss") != std::string::npos;
        const bool maps_mission_progress =
            output.port.find("mission_progress") != std::string::npos ||
            output.world_path.find("mission.progress") != std::string::npos;

        if (maps_sensor_confidence) {
            const double cyber_integrity = inputValueOr("cyber_degradation", 1.0);
            value = std::clamp(cyber_integrity * 0.9263157894736842, 0.0, 1.0);
        } else if (maps_packet_loss) {
            const double attack = inputValueOr("attack_intensity", 0.0);
            value = std::clamp(attack * 0.35, 0.0, 1.0);
        } else if (maps_mission_progress) {
            const double effectiveness = inputValueOr("mission_effectiveness", 0.0);
            value = std::clamp(effectiveness + 0.01, 0.0, 1.0);
        } else if (config_.inputs.size() == 1 && config_.outputs.size() == 1) {
            value = inputValueOr(config_.inputs.front().port, 0.0);
        } else {
            value = inputValueOr(output.port, 0.0);
        }

        output_values_[output.port] = value;
    }
}

void FmuComponent::step(double current_time) {
    if (!loaded_) {
        initialize();
    }
    if (config_.step_size <= 0.0) {
        return;
    }
    while (last_step_time_ + config_.step_size <= current_time + 1e-9) {
        computeOutputs();
        last_step_time_ += config_.step_size;
    }
}

} // namespace darla
