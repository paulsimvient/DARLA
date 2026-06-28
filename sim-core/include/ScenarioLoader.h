#pragma once

#include "WorldState.h"

#include <filesystem>

namespace darla {

class ScenarioLoader {
public:
    Scenario load(const std::filesystem::path& path) const;
};

} // namespace darla
