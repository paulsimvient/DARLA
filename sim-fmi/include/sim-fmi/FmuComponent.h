#pragma once

#include "FmuConfig.h"

#include <map>
#include <string>
#include <vector>

namespace darla {

enum class FmuPortDirection {
    Input,
    Output
};

struct FmuPort {
    std::string name;
    FmuPortDirection direction = FmuPortDirection::Input;
    std::string world_path;
};

class FmuComponent {
public:
    explicit FmuComponent(FmuComponentConfig config);

    const FmuComponentConfig& config() const { return config_; }
    const std::vector<FmuPort>& ports() const { return ports_; }
    bool loaded() const { return loaded_; }
    const std::string& loadMode() const { return load_mode_; }
    double lastStepTime() const { return last_step_time_; }
    const std::map<std::string, double>& inputValues() const { return input_values_; }
    const std::map<std::string, double>& outputValues() const { return output_values_; }

    bool initialize();
    void restoreRuntime(const FmuRuntimeState& state);
    void exportRuntime(FmuRuntimeState* state) const;
    void setInput(const std::string& port_name, double value);
    bool getOutput(const std::string& port_name, double* out) const;
    void step(double current_time);

private:
    void computeOutputs();
    double inputValueOr(const std::string& port_name, double fallback) const;
    static std::map<std::string, double> portMapFromRuntime(const std::vector<FmuPortRuntimeValue>& values);
    static void portMapToRuntime(
        const std::map<std::string, double>& values,
        std::vector<FmuPortRuntimeValue>* out);

    FmuComponentConfig config_;
    std::vector<FmuPort> ports_;
    std::map<std::string, double> input_values_;
    std::map<std::string, double> output_values_;
    bool loaded_ = false;
    bool fmi_file_present_ = false;
    std::string load_mode_ = "analytical_stub";
    double last_step_time_ = 0.0;
};

} // namespace darla
