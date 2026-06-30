#pragma once

#include "AgentBeliefState.h"
#include "CourseOfAction.h"
#include "Entity.h"
#include "ExecutionBudget.h"
#include "RelationshipTypes.h"
#include "ScriptComponent.h"
#include "StructuralCausalModel.h"
#include "SimRealism.h"

#include "FmuConfig.h"

#include <map>
#include <string>
#include <vector>

namespace darla {

struct ScriptedEvent {
    Tick tick = 0;
    std::string actor;
    std::string action;
    std::string target;
    double sensor_confidence_delta = 0.0;
    double network_integrity_delta = 0.0;
};

struct MissionConfig {
    std::string objective;
    Tick target_detected_before_tick = 2200;
    double track_confidence_min = 0.70;
    bool engagement_authority_available = true;
};

struct PlantedCausalEdge {
    std::string cause;
    std::string effect;
};

struct TimelineConfig {
    bool pause_at_coa_reviews = true;
    int tick_pacing_ms = 0;
};

struct EnvironmentState {
    std::string theater;
    std::string weather_summary;
    double visibility_km = 15.0;
    double wind_kts = 12.0;
    std::string wind_direction;
    int sea_state = 2;
    std::string weather_source;
};

struct OpenDataConfig {
    std::string ais_tracks_path;
    std::string weather_path;
    std::string provenance_path;
    std::string data_mode = "synthetic";
};

struct AisTrackPoint {
    double lat = 0.0;
    double lon = 0.0;
};

struct AisTrack {
    std::string mmsi;
    std::string name;
    std::vector<AisTrackPoint> points;
};

struct Scenario {
    SimConfig config;
    TimelineConfig timeline;
    MissionConfig mission;
    EnvironmentState environment;
    OpenDataConfig open_data;
    std::vector<AisTrack> ais_tracks;
    std::vector<Entity> entities;
    std::vector<ScriptedEvent> scripted_events;
    std::vector<RelationshipEdge> relationships;
    std::vector<PlantedCausalEdge> planted_causal_truth;
    std::vector<FmuComponentConfig> fmus;
    ScmParameters scm;
};

class RelationshipGraph;
class ActionEffectEstimator;

struct AgentRuntimeContext {
    const RelationshipGraph* relationships = nullptr;
    const ActionEffectEstimator* estimator = nullptr;
    Tick horizon_ticks = 0;
};

struct MissionMetrics {
    bool target_detected = false;
    Tick detection_time = 0;
    Tick coa_selection_time = 0;
    bool emergent_tempo_collapse = false;
    bool mission_success = false;
    double mission_success_score = 0.0;
};

struct ScheduledIntervention {
    std::string type;
    Tick at_tick = 0;
    std::string target;
    bool applied = false;
};

struct PendingCyberAttack {
    bool pending = false;
    std::string actor;
    std::string target;
    std::string action;
    double sensor_confidence_delta = 0.0;
    double network_integrity_delta = 0.0;
};

struct WorldState {
    Tick tick = 0;
    std::map<EntityId, Entity> entities;
    std::map<std::string, EntityId> ids_by_name;
    MissionConfig mission;
    std::vector<ScriptedEvent> scripted_events;
    std::vector<ScheduledIntervention> scheduled_interventions;
    MissionMetrics metrics;
    bool cyber_degradation_applied = false;
    bool comms_degradation_only = false;
    PendingCyberAttack pending_cyber_attack;
    bool logistics_delay_recorded = false;
    bool sensor_loss_recorded = false;
    bool detection_delay_recorded = false;
    bool detection_recorded = false;
    bool coa_recorded = false;
    bool mission_effect_recorded = false;
    bool emergent_recorded = false;
    bool intervention_applied = false;
    bool suppress_logistics_delay = false;
    bool realtime_agents_enabled = false;
    bool autonomous_search_enabled = false;
    bool engagement_pre_authorized = false;
    AuthorizationMode authorization_mode = AuthorizationMode::PolicyAuto;
    std::vector<ApprovedCoa> approved_coas;
    std::vector<CourseOfAction> coa_log;
    int next_coa_id = 1;
    AgentBeliefRegistry agent_beliefs;
    AgentRuntimeContext agent_runtime;
    RuntimeBudgetState runtime_budgets;
    std::vector<FmuComponentConfig> fmu_configs;
    std::vector<FmuRuntimeState> fmu_runtime;
    std::vector<PythonScriptRuntimeState> python_script_runtime;
    std::vector<PlantedCausalEdge> planted_truth;
    ScmParameters scm;
    RealismConfig realism;
    RealismRuntimeState realism_runtime;
    bool scm_noise_enabled = false;
    std::uint64_t scm_noise_seed = 0;
    EnvironmentState environment;
    OpenDataConfig open_data;
    std::vector<AisTrack> ais_tracks;

    Entity* entityByName(const std::string& name);
    const Entity* entityByName(const std::string& name) const;
};

} // namespace darla
