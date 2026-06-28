#include "sim-fmi/FmuRegistry.h"

namespace darla {
namespace {

FmuRuntimeState* findRuntime(WorldState& world, const std::string& id) {
    for (auto& runtime : world.fmu_runtime) {
        if (runtime.id == id) {
            return &runtime;
        }
    }
    return nullptr;
}

} // namespace

void FmuRegistry::loadFromConfig(const std::vector<FmuComponentConfig>& configs) {
    components_.clear();
    components_.reserve(configs.size());
    for (const auto& config : configs) {
        FmuComponent component{config};
        component.initialize();
        components_.push_back(std::move(component));
    }
}

void FmuRegistry::restoreFromWorld(WorldState& world) {
    loadFromConfig(world.fmu_configs);
    for (auto& component : components_) {
        if (const auto* runtime = findRuntime(world, component.config().id)) {
            component.restoreRuntime(*runtime);
        }
    }
}

void FmuRegistry::syncRuntimeToWorld(WorldState& world) const {
    for (const auto& component : components_) {
        if (auto* runtime = findRuntime(world, component.config().id)) {
            component.exportRuntime(runtime);
            continue;
        }
        FmuRuntimeState runtime;
        component.exportRuntime(&runtime);
        world.fmu_runtime.push_back(std::move(runtime));
    }
}

} // namespace darla
