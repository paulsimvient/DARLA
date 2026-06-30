#include "SimRealism.h"

#include "CourseOfAction.h"
#include "Entity.h"
#include "StructuralCausalModel.h"
#include "WorldState.h"

#include <algorithm>
#include <cmath>
#include <iomanip>
#include <numeric>
#include <sstream>

namespace darla {
namespace {

double clip01(double value) {
    return std::clamp(value, 0.0, 1.0);
}

std::string join(const std::vector<std::string>& values, const std::string& sep) {
    std::ostringstream out;
    for (std::size_t i = 0; i < values.size(); ++i) {
        if (i > 0) out << sep;
        out << values[i];
    }
    return out.str();
}

Tick quantileTick(std::vector<Tick> values, double p) {
    if (values.empty()) return 0;
    std::sort(values.begin(), values.end());
    const auto idx = static_cast<std::size_t>(std::clamp(p, 0.0, 1.0) * static_cast<double>(values.size() - 1));
    return values[idx];
}

double quantile(std::vector<double> values, double p) {
    if (values.empty()) return 0.0;
    std::sort(values.begin(), values.end());
    const auto idx = static_cast<std::size_t>(std::clamp(p, 0.0, 1.0) * static_cast<double>(values.size() - 1));
    return values[idx];
}

DetectionInputs detectionInputsForWorld(const WorldState& world, ActionType action = ActionType::HoldCurrentCOA) {
    const auto* uas = world.entityByName("blue_uas_1");
    const auto* relay = world.entityByName("blue_relay_1");
    DetectionInputs inputs;
    inputs.degraded = uas && uas->sensor && uas->sensor->degraded;
    inputs.isolated = uas && uas->sensor && uas->sensor->isolated;
    inputs.autonomous = world.autonomous_search_enabled;
    inputs.comms_blocking = world.comms_degradation_only && relay && relay->comms && relay->comms->compromised;

    switch (action) {
    case ActionType::IsolateCompromisedSensorFeed:
        inputs.isolated = true;
        inputs.degraded = true;
        inputs.comms_blocking = false;
        break;
    case ActionType::RestoreCommsRelay:
        inputs.comms_blocking = false;
        break;
    case ActionType::EnableAutonomousSearch:
        inputs.autonomous = true;
        break;
    case ActionType::PreAuthorizeEngagement:
    case ActionType::HoldCurrentCOA:
        break;
    }
    return inputs;
}

MissionInputs missionInputsForWorld(const WorldState& world, ActionType action, bool success, const DetectionInputs& detection) {
    const auto* uas = world.entityByName("blue_uas_1");
    MissionInputs inputs;
    inputs.success = success;
    inputs.autonomous = detection.autonomous;
    inputs.isolated = detection.isolated;
    inputs.preauthorized = world.engagement_pre_authorized || action == ActionType::PreAuthorizeEngagement;
    inputs.high_confidence = uas && uas->sensor && uas->sensor->confidence >= world.mission.track_confidence_min;
    if (action == ActionType::IsolateCompromisedSensorFeed) inputs.high_confidence = true;
    return inputs;
}

} // namespace

const char* toString(RedPolicyMode mode) {
    switch (mode) {
    case RedPolicyMode::Scripted: return "scripted";
    case RedPolicyMode::AdaptiveOpportunistic: return "adaptive_opportunistic";
    case RedPolicyMode::HybridScriptedAdaptive: return "hybrid_scripted_adaptive";
    }
    return "unknown";
}

RedPolicyMode redPolicyModeFromString(const std::string& value) {
    if (value == "scripted") return RedPolicyMode::Scripted;
    if (value == "adaptive_opportunistic" || value == "adaptive") return RedPolicyMode::AdaptiveOpportunistic;
    return RedPolicyMode::HybridScriptedAdaptive;
}

CoaConstraintProfile defaultConstraintFor(ActionType action) {
    CoaConstraintProfile profile;
    profile.action = action;
    switch (action) {
    case ActionType::IsolateCompromisedSensorFeed:
        profile.authority_required = "tactical_commander";
        profile.execution_delay_min = 60;
        profile.execution_delay_mode = 120;
        profile.execution_delay_max = 240;
        profile.base_probability_of_success = 0.72;
        profile.resource_cost = 0.06;
        profile.operational_risk = 0.10;
        profile.required_conditions = {"cyber_team_available", "alternate_sensor_path_available"};
        profile.side_effects = {"temporary_sensor_blindness", "reduced sensor fusion confidence during isolation"};
        profile.validity_envelope = "maritime ISR cyber-sensor degradation";
        break;
    case ActionType::RestoreCommsRelay:
        profile.authority_required = "network_operations";
        profile.execution_delay_min = 90;
        profile.execution_delay_mode = 180;
        profile.execution_delay_max = 360;
        profile.base_probability_of_success = 0.64;
        profile.resource_cost = 0.08;
        profile.operational_risk = 0.07;
        profile.required_conditions = {"relay_access_available", "trusted_route_available"};
        profile.side_effects = {"temporary routing instability"};
        profile.validity_envelope = "degraded relay/comms path";
        break;
    case ActionType::EnableAutonomousSearch:
        profile.authority_required = "mission_commander";
        profile.execution_delay_min = 30;
        profile.execution_delay_mode = 90;
        profile.execution_delay_max = 180;
        profile.base_probability_of_success = 0.58;
        profile.resource_cost = 0.10;
        profile.operational_risk = 0.18;
        profile.required_conditions = {"autonomy_package_available", "search_area_bounded"};
        profile.side_effects = {"higher false-positive rate", "operator workload increase"};
        profile.validity_envelope = "bounded maritime search";
        break;
    case ActionType::PreAuthorizeEngagement:
        profile.authority_required = "engagement_authority";
        profile.execution_delay_min = 20;
        profile.execution_delay_mode = 60;
        profile.execution_delay_max = 120;
        profile.base_probability_of_success = 0.52;
        profile.resource_cost = 0.04;
        profile.operational_risk = 0.26;
        profile.required_conditions = {"positive_identification", "roe_threshold_met"};
        profile.side_effects = {"higher authority risk", "reduced decision dwell time"};
        profile.validity_envelope = "positive identification with adequate track confidence";
        break;
    case ActionType::HoldCurrentCOA:
        profile.authority_required = "none";
        profile.execution_delay_min = 0;
        profile.execution_delay_mode = 0;
        profile.execution_delay_max = 0;
        profile.base_probability_of_success = 0.35;
        profile.resource_cost = 0.0;
        profile.operational_risk = 0.22;
        profile.required_conditions = {};
        profile.side_effects = {"mission risk may continue increasing"};
        profile.validity_envelope = "safe fallback when intervention evidence is insufficient";
        break;
    }
    return profile;
}

RealismConfig makeDefaultRealismConfig(const Scenario& scenario) {
    RealismConfig config;
    config.realism_level = "synthetic-calibrated";
    config.red_adversary.mode = RedPolicyMode::HybridScriptedAdaptive;
    config.red_adversary.objectives = {
        {"delay_target_detection", 0.45},
        {"degrade_blue_trust", 0.35},
        {"preserve_stealth", 0.20},
    };
    config.confounders = {
        {"weather_visibility", "Weather visibility degradation", "environment.visibility_km", 0.18, scenario.config.max_ticks / 5, false, "Weather can reduce detection confidence and compete with cyber as an explanation."},
        {"relay_latency", "Independent relay latency spike", "blue_relay_1.comms.latency_sec", 0.14, scenario.config.max_ticks / 3, false, "Relay latency can delay reports without being the primary sensor-cyber cause."},
        {"operator_workload", "Operator workload delay", "blue_commander.decision_latency", 0.10, scenario.config.max_ticks / 2, false, "Human workload introduces shared tempo noise between detection and action."},
    };
    config.coa_constraints[ActionType::IsolateCompromisedSensorFeed] = defaultConstraintFor(ActionType::IsolateCompromisedSensorFeed);
    config.coa_constraints[ActionType::RestoreCommsRelay] = defaultConstraintFor(ActionType::RestoreCommsRelay);
    config.coa_constraints[ActionType::EnableAutonomousSearch] = defaultConstraintFor(ActionType::EnableAutonomousSearch);
    config.coa_constraints[ActionType::PreAuthorizeEngagement] = defaultConstraintFor(ActionType::PreAuthorizeEngagement);
    config.coa_constraints[ActionType::HoldCurrentCOA] = defaultConstraintFor(ActionType::HoldCurrentCOA);

    config.validity_envelope.model_id = "darla-maritime-cyber-scm-v1";
    config.validity_envelope.domain = "synthetic maritime ISR cyber mission";
    config.validity_envelope.valid_for = {"UAS sensor confidence degradation", "relay latency/packet-loss effects", "bounded counterfactual COA comparison", "mission timing outcomes"};
    config.validity_envelope.not_valid_for = {"kinetic weapons effects", "classified EW behavior", "dense civilian maritime traffic", "live cyber network attribution"};
    config.validity_envelope.assumptions = {"single red cyber actor", "one primary UAS ISR asset", "Gaussian SCM exogenous noise", "COA effects are bounded synthetic estimates"};
    config.validity_envelope.calibration_basis = CalibrationBasis::Synthetic;
    config.validity_envelope.confidence = 0.62;
    return config;
}

CoaGateAssessment assessCoaGate(const WorldState& world, const CoaConstraintProfile& profile) {
    CoaGateAssessment gate;
    gate.expected_delay_ticks = profile.execution_delay_mode;
    gate.probability_of_success = profile.base_probability_of_success;
    gate.side_effect_risk = profile.operational_risk;

    const auto* uas = world.entityByName("blue_uas_1");
    const auto* relay = world.entityByName("blue_relay_1");

    if (profile.action == ActionType::IsolateCompromisedSensorFeed) {
        gate.preconditions_satisfied = uas && uas->sensor && uas->sensor->degraded;
        gate.rationale = gate.preconditions_satisfied
            ? "sensor path is degraded; isolation has a plausible causal lever"
            : "sensor path is not currently degraded; isolation is not justified";
        gate.probability_of_success += gate.preconditions_satisfied ? 0.06 : -0.20;
    } else if (profile.action == ActionType::RestoreCommsRelay) {
        gate.preconditions_satisfied = relay && relay->comms && (relay->comms->compromised || relay->comms->packet_loss > 0.10 || relay->comms->latency_sec > 3.0);
        gate.rationale = gate.preconditions_satisfied
            ? "relay/comms path is degraded enough to justify restoration"
            : "relay is not the dominant degraded component";
        gate.probability_of_success += gate.preconditions_satisfied ? 0.03 : -0.12;
    } else if (profile.action == ActionType::EnableAutonomousSearch) {
        gate.preconditions_satisfied = world.cyber_degradation_applied && !world.metrics.target_detected;
        gate.rationale = gate.preconditions_satisfied
            ? "target is not detected and autonomous search can reduce detection delay"
            : "autonomous search has limited value after target detection";
    } else if (profile.action == ActionType::PreAuthorizeEngagement) {
        gate.authority_satisfied = world.mission.engagement_authority_available;
        gate.preconditions_satisfied = world.metrics.target_detected || (uas && uas->sensor && uas->sensor->confidence >= world.mission.track_confidence_min);
        gate.rationale = gate.preconditions_satisfied
            ? "track/detection conditions are close enough for preauthorization analysis"
            : "positive detection/track confidence is not adequate for preauthorization";
    } else {
        gate.rationale = "hold is always available but carries mission-delay risk";
    }

    gate.probability_of_success = clip01(gate.probability_of_success);
    gate.resources_satisfied = true;
    gate.validity_satisfied = true;

    if (!gate.authority_satisfied || !gate.preconditions_satisfied || !gate.resources_satisfied || !gate.validity_satisfied) {
        gate.disposition = "fail";
    } else if (gate.side_effect_risk > 0.16 || gate.probability_of_success < 0.60) {
        gate.disposition = "caution";
    } else {
        gate.disposition = "pass";
    }
    return gate;
}

MonteCarloBranchSummary estimateMonteCarloBranch(const WorldState& world, ActionType action, const std::string& target, int replicates) {
    MonteCarloBranchSummary summary;
    summary.action = action;
    summary.target = target;
    summary.replicates = std::max(12, replicates);

    const StructuralCausalModel scm(world.scm);
    const auto baseline_detection = detectionInputsForWorld(world, ActionType::HoldCurrentCOA);
    const auto intervention_detection = detectionInputsForWorld(world, action);

    summary.baseline_success_probability = scm.probabilityDetectBeforeCutoff(baseline_detection, world.mission.target_detected_before_tick);
    summary.intervention_success_probability = scm.probabilityDetectBeforeCutoff(intervention_detection, world.mission.target_detected_before_tick);

    std::vector<double> gains;
    std::vector<Tick> detection_ticks;
    gains.reserve(summary.replicates);
    detection_ticks.reserve(summary.replicates);

    for (int i = 0; i < summary.replicates; ++i) {
        const std::uint64_t stream = 100000 + static_cast<std::uint64_t>(i) * 37 + static_cast<std::uint64_t>(action);
        const Tick base_detection_tick = scm.detectionTick(baseline_detection, world.scm_noise_seed + 1009, stream);
        const Tick intervention_detection_tick = scm.detectionTick(intervention_detection, world.scm_noise_seed + 2003, stream + 1);

        const bool base_success = base_detection_tick <= world.mission.target_detected_before_tick;
        const bool intervention_success = intervention_detection_tick <= world.mission.target_detected_before_tick;
        const auto base_mission = missionInputsForWorld(world, ActionType::HoldCurrentCOA, base_success, baseline_detection);
        const auto intervention_mission = missionInputsForWorld(world, action, intervention_success, intervention_detection);
        const double base_score = scm.missionScore(base_mission, world.scm_noise_seed + 3001, stream + 2);
        const double intervention_score = scm.missionScore(intervention_mission, world.scm_noise_seed + 4001, stream + 3);
        gains.push_back(intervention_score - base_score);
        detection_ticks.push_back(intervention_detection_tick);
    }

    summary.expected_mission_gain_mean = std::accumulate(gains.begin(), gains.end(), 0.0) / static_cast<double>(gains.size());
    summary.expected_mission_gain_lower90 = quantile(gains, 0.05);
    summary.expected_mission_gain_upper90 = quantile(gains, 0.95);
    summary.detection_time_mean = static_cast<Tick>(std::llround(
        std::accumulate(detection_ticks.begin(), detection_ticks.end(), 0.0) / static_cast<double>(detection_ticks.size())));
    summary.detection_time_lower90 = quantileTick(detection_ticks, 0.05);
    summary.detection_time_upper90 = quantileTick(detection_ticks, 0.95);
    summary.downside_risk = static_cast<double>(std::count_if(gains.begin(), gains.end(), [](double g) { return g < -0.02; })) / static_cast<double>(gains.size());

    const double interval_width = std::max(0.01, summary.expected_mission_gain_upper90 - summary.expected_mission_gain_lower90);
    summary.confidence = clip01(0.45 + std::abs(summary.expected_mission_gain_mean) * 1.4 - interval_width * 0.6 + static_cast<double>(summary.replicates) / 600.0);
    return summary;
}

void applyCoaRealism(CourseOfAction& coa, const WorldState& world) {
    CoaConstraintProfile profile = defaultConstraintFor(coa.action);
    if (const auto it = world.realism.coa_constraints.find(coa.action); it != world.realism.coa_constraints.end()) {
        profile = it->second;
    }
    const auto gate = assessCoaGate(world, profile);
    const auto mc = estimateMonteCarloBranch(world, coa.action, coa.target, world.realism.monte_carlo_replicates);

    coa.authority_required = profile.authority_required;
    coa.authority_satisfied = gate.authority_satisfied;
    coa.preconditions_satisfied = gate.preconditions_satisfied;
    coa.resources_satisfied = gate.resources_satisfied;
    coa.validity_satisfied = gate.validity_satisfied;
    coa.gate_disposition = gate.disposition;
    coa.gate_rationale = gate.rationale;
    coa.execution_delay_min = profile.execution_delay_min;
    coa.execution_delay_mode = profile.execution_delay_mode;
    coa.execution_delay_max = profile.execution_delay_max;
    coa.probability_of_success = gate.probability_of_success;
    coa.side_effect_risk = gate.side_effect_risk;
    coa.side_effects = profile.side_effects;
    coa.monte_carlo_replicates = mc.replicates;
    coa.mc_expected_mission_gain_mean = mc.expected_mission_gain_mean;
    coa.mc_expected_mission_gain_lower90 = mc.expected_mission_gain_lower90;
    coa.mc_expected_mission_gain_upper90 = mc.expected_mission_gain_upper90;
    coa.mc_detection_time_mean = mc.detection_time_mean;
    coa.mc_downside_risk = mc.downside_risk;

    // Score remains causal-first, but gates and branch uncertainty now penalize unrealistic actions.
    if (gate.disposition == "fail") {
        coa.score -= 0.50;
        coa.risk = std::max(coa.risk, 0.30);
    } else if (gate.disposition == "caution") {
        coa.score -= 0.12;
        coa.risk = std::max(coa.risk, profile.operational_risk);
    }
    coa.score += std::max(-0.20, std::min(0.20, mc.expected_mission_gain_mean * 0.35));
}

void refreshRealismRuntime(WorldState& world) {
    const auto* uas = world.entityByName("blue_uas_1");
    const auto* relay = world.entityByName("blue_relay_1");
    const double sensor_confidence = uas && uas->sensor ? uas->sensor->confidence : 0.80;
    const double packet_loss = relay && relay->comms ? relay->comms->packet_loss : 0.03;
    const double relay_latency = relay && relay->comms ? relay->comms->latency_sec : 0.0;

    for (auto& confounder : world.realism.confounders) {
        confounder.active = confounder.onset_tick > 0 && world.tick >= confounder.onset_tick;
    }

    auto& hypotheses = world.realism_runtime.blue_hypotheses;
    const double weather_strength = [&]() {
        double value = 0.0;
        for (const auto& c : world.realism.confounders) {
            if (c.id == "weather_visibility" && c.active) value = std::max(value, c.strength);
        }
        return value;
    }();
    const double relay_strength = [&]() {
        double value = 0.0;
        for (const auto& c : world.realism.confounders) {
            if (c.id == "relay_latency" && c.active) value = std::max(value, c.strength);
        }
        return value;
    }();

    hypotheses.cyber_compromise = clip01(0.08 + (world.cyber_degradation_applied ? 0.54 : 0.0) + (sensor_confidence < 0.60 ? 0.18 : 0.0) + (packet_loss > 0.15 ? 0.08 : 0.0));
    hypotheses.weather_degradation = clip01(0.06 + weather_strength + (world.environment.visibility_km < 8.0 ? 0.28 : 0.0));
    hypotheses.sensor_fault = clip01(0.08 + (sensor_confidence < 0.60 && !world.cyber_degradation_applied ? 0.22 : 0.04));
    hypotheses.relay_failure = clip01(0.05 + relay_strength + (relay_latency > 3.0 ? 0.22 : 0.0) + (packet_loss > 0.12 ? 0.10 : 0.0));
    const double total_known = hypotheses.cyber_compromise + hypotheses.weather_degradation + hypotheses.sensor_fault + hypotheses.relay_failure;
    if (total_known > 0.95) {
        const double scale = 0.95 / total_known;
        hypotheses.cyber_compromise *= scale;
        hypotheses.weather_degradation *= scale;
        hypotheses.sensor_fault *= scale;
        hypotheses.relay_failure *= scale;
    }
    hypotheses.unknown = clip01(1.0 - (hypotheses.cyber_compromise + hypotheses.weather_degradation + hypotheses.sensor_fault + hypotheses.relay_failure));

    world.agent_beliefs.commander.p_cyber_compromise = hypotheses.cyber_compromise;
    world.agent_beliefs.commander.p_weather_degradation = hypotheses.weather_degradation;
    world.agent_beliefs.commander.p_sensor_fault = hypotheses.sensor_fault;
    world.agent_beliefs.commander.p_relay_failure = hypotheses.relay_failure;

    world.realism_runtime.red_target_score_uas = clip01(world.realism.red_adversary.mission_effect_weight * (1.0 - sensor_confidence) + world.realism.red_adversary.stealth_weight * 0.45);
    world.realism_runtime.red_target_score_relay = clip01(world.realism.red_adversary.mission_effect_weight * (packet_loss + relay_latency / 10.0) + world.realism.red_adversary.stealth_weight * 0.36);

    std::ostringstream red;
    red << "adaptive target scores: uas=" << std::fixed << std::setprecision(2) << world.realism_runtime.red_target_score_uas
        << ", relay=" << world.realism_runtime.red_target_score_relay
        << "; policy=" << toString(world.realism.red_adversary.mode);
    world.realism_runtime.last_red_decision_summary = red.str();

    world.realism_runtime.uncertainty_bands.clear();
    world.realism_runtime.uncertainty_bands.push_back(UncertainValue{
        "blue_uas_1.sensor.confidence",
        makeConfidenceBand(sensor_confidence, world.cyber_degradation_applied ? 0.14 : 0.07, world.sensor_loss_recorded ? 3 : 1),
        "SCM + sensor-agent observation",
        world.realism.validity_envelope.model_id});
    world.realism_runtime.uncertainty_bands.push_back(UncertainValue{
        "blue_commander.belief.cyber_compromise",
        makeConfidenceBand(hypotheses.cyber_compromise, 0.16, world.cyber_degradation_applied ? 4 : 1),
        "partial-observability belief update",
        world.realism.validity_envelope.model_id});
    world.realism_runtime.uncertainty_bands.push_back(UncertainValue{
        "mission.success_score",
        makeConfidenceBand(world.metrics.mission_success_score, world.mission_effect_recorded ? 0.10 : 0.18, world.mission_effect_recorded ? 5 : 2),
        "mission SCM outcome",
        world.realism.validity_envelope.model_id});

    world.realism_runtime.latest_branch_summaries.clear();
    world.realism_runtime.latest_branch_summaries.push_back(estimateMonteCarloBranch(world, ActionType::IsolateCompromisedSensorFeed, "blue_uas_1", world.realism.monte_carlo_replicates));
    world.realism_runtime.latest_branch_summaries.push_back(estimateMonteCarloBranch(world, ActionType::RestoreCommsRelay, "blue_relay_1", world.realism.monte_carlo_replicates));
    world.realism_runtime.latest_branch_summaries.push_back(estimateMonteCarloBranch(world, ActionType::EnableAutonomousSearch, "blue_uas_1", world.realism.monte_carlo_replicates));
    world.realism_runtime.latest_branch_summaries.push_back(estimateMonteCarloBranch(world, ActionType::PreAuthorizeEngagement, "blue_commander", world.realism.monte_carlo_replicates));
    world.realism_runtime.last_realism_update_tick = world.tick;
}

} // namespace darla
