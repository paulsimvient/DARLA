#pragma once

#include <cstdint>
#include <string>

namespace darla {

using EntityId = std::uint64_t;
using EventId = std::uint64_t;
using Tick = std::uint64_t;
using NodeId = std::uint64_t;

struct SimConfig {
    std::uint64_t seed = 42;
    double tick_seconds = 1.0;
    Tick max_ticks = 5000;
    std::string scenario_id = "uas-maritime-cyber-v001";
};

} // namespace darla
