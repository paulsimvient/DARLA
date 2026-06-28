#pragma once

#include "WorldState.h"
#include "sim-events/EventLedger.h"

#include <string>
#include <vector>

namespace darla {

struct EmergenceMetrics {
    double decision_latency = 0.0;
    double sensor_trust = 1.0;
    double comms_congestion = 0.0;
    double mission_tempo_ratio = 0.0;
    double coa_delay_penalty = 0.0;
    double coa_entropy = 0.0;
};

struct EmergenceDetection {
    bool detected = false;
    EmergenceMetrics metrics;
    std::vector<std::string> patterns;
    std::string summary;
};

class EmergenceDetector {
public:
    EmergenceDetection evaluate(const WorldState& world, const EventLedger& ledger) const;
};

} // namespace darla
