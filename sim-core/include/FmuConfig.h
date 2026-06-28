#pragma once

#include <string>
#include <vector>

namespace darla {

struct FmuPortBinding {
    std::string port;
    std::string world_path;
};

struct FmuComponentConfig {
    std::string id;
    std::string path;
    double step_size = 1.0;
    std::vector<FmuPortBinding> inputs;
    std::vector<FmuPortBinding> outputs;
};

struct FmuPortRuntimeValue {
    std::string port;
    double value = 0.0;
};

struct FmuRuntimeState {
    std::string id;
    std::string load_mode;
    bool initialized = false;
    double last_step_time = 0.0;
    std::vector<FmuPortRuntimeValue> inputs;
    std::vector<FmuPortRuntimeValue> outputs;
};

} // namespace darla
