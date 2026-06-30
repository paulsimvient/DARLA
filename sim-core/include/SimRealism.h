#pragma once

#include "ActionType.h"
#include "Types.h"
#include "Uncertainty.h"
#include "ModelValidity.h"

#include <cstdint>
#include <map>
#include <string>
#include <vector>

namespace darla {

struct WorldState;
struct Scenario;
struct CourseOfAction;

// How adversary behavior is generated. Scripted keeps legacy deterministic demos;
// AdaptiveOpportunistic still honors scenario triggers but uses target scoring,
// stealth/access estimates, and mission-effect tradeoffs to choose/justify effects.
enum class RedPolicyMode {
    Scripted,
    AdaptiveOpportunistic,
    HybridScriptedAdaptive
};

struct RedAdversaryObjective {
    std::string id;
    double weight = 1.0;
};

struct RedAdversaryConfig {
    RedPolicyMode mode = RedPolicyMode::HybridScriptedAdaptive;
    double initial_access_probability = 0.58;
    double stealth_weight = 0.35;
    double mission_effect_weight = 0.65;
    double blue_detection_weight = 0.25;
    Tick mean_dwell_ticks = 420;
    Tick dwell_sigma_ticks = 90;
    int max_actions = 3;
    std::vector<RedAdversaryObjective> objectives;
};

struct ConfounderConfig {
    std::string id;
    std::string label;
    std::string variable;
    double strength = 0.0;
    Tick onset_tick = 0;
    bool active = false;
    std::string explanation;
};

struct CoaConstraintProfile {
    ActionType action = ActionType::HoldCurrentCOA;
    std::string authority_required = "none";
    Tick execution_delay_min = 0;
    Tick execution_delay_mode = 0;
    Tick execution_delay_max = 0;
    double base_probability_of_success = 0.5;
    double resource_cost = 0.0;
    double operational_risk = 0.0;
    std::vector<std::string> required_conditions;
    std::vector<std::string> side_effects;
    std::string validity_envelope;
};

struct CoaGateAssessment {
    bool authority_satisfied = true;
    bool preconditions_satisfied = true;
    bool resources_satisfied = true;
    bool validity_satisfied = true;
    std::string disposition = "pass"; // pass | caution | fail
    std::string rationale;
    double probability_of_success = 0.5;
    Tick expected_delay_ticks = 0;
    double side_effect_risk = 0.0;
};

struct MonteCarloBranchSummary {
    ActionType action = ActionType::HoldCurrentCOA;
    std::string target;
    int replicates = 0;
    double baseline_success_probability = 0.0;
    double intervention_success_probability = 0.0;
    double expected_mission_gain_mean = 0.0;
    double expected_mission_gain_lower90 = 0.0;
    double expected_mission_gain_upper90 = 0.0;
    Tick detection_time_mean = 0;
    Tick detection_time_lower90 = 0;
    Tick detection_time_upper90 = 0;
    double downside_risk = 0.0;
    double confidence = 0.0;
};

struct RealismConfig {
    std::string realism_level = "synthetic-calibrated";
    RedAdversaryConfig red_adversary;
    std::vector<ConfounderConfig> confounders;
    std::map<ActionType, CoaConstraintProfile> coa_constraints;
    ModelValidityEnvelope validity_envelope;
    int monte_carlo_replicates = 96;
};

struct BeliefHypotheses {
    double cyber_compromise = 0.05;
    double weather_degradation = 0.05;
    double sensor_fault = 0.05;
    double relay_failure = 0.05;
    double unknown = 0.80;
};

struct RealismRuntimeState {
    BeliefHypotheses blue_hypotheses;
    std::vector<UncertainValue> uncertainty_bands;
    std::vector<MonteCarloBranchSummary> latest_branch_summaries;
    std::string last_red_decision_summary;
    double red_target_score_uas = 0.0;
    double red_target_score_relay = 0.0;
    Tick last_realism_update_tick = 0;
};

const char* toString(RedPolicyMode mode);
RedPolicyMode redPolicyModeFromString(const std::string& value);

RealismConfig makeDefaultRealismConfig(const Scenario& scenario);
CoaConstraintProfile defaultConstraintFor(ActionType action);
CoaGateAssessment assessCoaGate(const WorldState& world, const CoaConstraintProfile& profile);
MonteCarloBranchSummary estimateMonteCarloBranch(const WorldState& world, ActionType action, const std::string& target, int replicates);
void applyCoaRealism(CourseOfAction& coa, const WorldState& world);
void refreshRealismRuntime(WorldState& world);

} // namespace darla
