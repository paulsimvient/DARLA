#pragma once

#include <string>

namespace darla {

struct KinematicState {
    double lat = 0.0;
    double lon = 0.0;
    double alt = 0.0;
    double heading_deg = 0.0;
    double speed_mps = 0.0;
};

struct SensorState {
    double confidence = 0.0;
    double range_km = 0.0;
    double latency_sec = 0.0;
    double false_positive_rate = 0.0;
    double false_negative_rate = 0.0;
    bool degraded = false;
    bool isolated = false;
};

struct CommsState {
    double bandwidth_mbps = 0.0;
    double latency_sec = 0.0;
    double packet_loss = 0.0;
    bool jammed = false;
    bool compromised = false;
};

struct CyberState {
    double integrity = 1.0;
    double compromise_probability = 0.0;
    double lateral_movement_risk = 0.0;
    bool isolated = false;
};

struct MissionState {
    std::string current_task;
    double progress = 0.0;
    double confidence = 0.0;
    double mission_effectiveness = 0.0;
};

} // namespace darla
