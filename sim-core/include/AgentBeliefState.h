#pragma once

#include "Types.h"

#include <string>
#include <vector>

namespace darla {

struct BeliefTrace {
    double uncertainty = 0.0;
    std::string provenance;
    EventId last_source_event_id = 0;
};

inline constexpr Tick kAgentMonitoringInterval = 120;
inline constexpr Tick kCausalScanInterval = 60;
inline constexpr Tick kCoaReviewInterval = 60;

struct CourseOfAction;

struct RedCyberBelief {
    double blue_posture_score = 0.0;
    double attack_opportunity = 0.0;
    bool attack_committed = false;
    Tick last_monitoring_tick = 0;
    Tick last_sense_tick = 0;
    BeliefTrace trace;
};

struct SensorBelief {
    double trust = 1.0;
    bool degraded = false;
    bool isolated = false;
    bool anomaly_active = false;
    bool initial_observation_emitted = false;
    Tick last_monitoring_tick = 0;
    Tick last_sense_tick = 0;
    BeliefTrace trace;
};

struct CommsBelief {
    double health = 1.0;
    double latency_sec = 0.0;
    double packet_loss = 0.0;
    bool operationally_relevant = false;
    bool anomaly_active = false;
    bool initial_observation_emitted = false;
    Tick last_monitoring_tick = 0;
    Tick last_sense_tick = 0;
    BeliefTrace trace;
};

struct UASBelief {
    std::string search_status = "idle";
    std::string autonomy_mode = "manual_search";
    double detection_progress = 0.0;
    bool anomaly_active = false;
    bool initial_observation_emitted = false;
    Tick last_monitoring_tick = 0;
    Tick last_sense_tick = 0;
};

struct LogisticsBelief {
    std::string supply_status = "nominal";
    bool correlated_delay = false;
    bool initial_observation_emitted = false;
    Tick last_monitoring_tick = 0;
    Tick last_sense_tick = 0;
};

struct CommanderBelief {
    double mission_risk = 0.0;
    double tempo_ratio = 0.0;
    double last_action_score = 0.0;
    std::string last_selected_action;
    bool primary_decision_recorded = false;
    Tick last_evaluation_tick = 0;
    Tick last_monitoring_tick = 0;
    Tick last_coa_review_tick = 0;
    int active_coa_id = 0;
    int last_recommendation_event_id = 0;
    bool anomaly_review_pending = false;
    bool anomaly_was_active = false;
    double coa_entropy = 0.0;
    BeliefTrace trace;
};

struct CausalMonitorBelief {
    std::vector<std::string> active_patterns;
    double sensor_trust = 1.0;
    double comms_congestion = 0.0;
    double mission_tempo_ratio = 0.0;
    bool emergence_warning = false;
    Tick last_scan_tick = 0;
};

struct CredibilityBelief {
    bool validity_ok = true;
    std::string envelope_status = "inside";
    std::string last_violation;
    Tick last_check_tick = 0;
};

struct AgentBeliefRegistry {
    RedCyberBelief red_cyber;
    SensorBelief sensor;
    CommsBelief comms;
    UASBelief uas;
    LogisticsBelief logistics;
    CommanderBelief commander;
    CausalMonitorBelief causal_monitor;
    CredibilityBelief credibility;
};

} // namespace darla
