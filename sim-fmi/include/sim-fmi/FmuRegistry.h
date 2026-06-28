#pragma once

#include "FmuComponent.h"
#include "FmuConfig.h"
#include "WorldState.h"

#include <vector>

namespace darla {

class FmuRegistry {
public:
    void restoreFromWorld(WorldState& world);
    void syncRuntimeToWorld(WorldState& world) const;
    std::vector<FmuComponent>& components() { return components_; }
    const std::vector<FmuComponent>& components() const { return components_; }
    bool empty() const { return components_.empty(); }

private:
    void loadFromConfig(const std::vector<FmuComponentConfig>& configs);

    std::vector<FmuComponent> components_;
};

} // namespace darla
