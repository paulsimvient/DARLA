#include "sim-causal/CausalClaimBuilder.h"

#include "Snapshot.h"
#include "sim-causal/CausalEffectEstimator.h"
#include "sim-causal/Identification.h"
#include "sim-causal/InterventionEngine.h"

#include <algorithm>
#include <cmath>
#include <utility>

namespace darla {
namespace {

const SimEvent* findEventByLabel(const EventLedger& ledger, const std::string& label) {
    for (const auto& event : ledger.events()) {
        if (event.label == label) return &event;
    }
    return nullptr;
}

// Largest relative magnitude of any numeric before/after delta on an event. Used to
// derive the directly-observed effect size of a manipulation from the ledger itself.
double observedDeltaMagnitude(const SimEvent& event) {
    double best = 0.0;
    for (const auto& delta : event.deltas) {
        try {
            const double before = std::stod(delta.before);
            const double after = std::stod(delta.after);
            const double denom = std::max(std::abs(before), 1e-6);
            best = std::max(best, std::abs(after - before) / denom);
        } catch (...) {
            // non-numeric delta: ignore
        }
    }
    return best;
}

CausalEffectEstimator::Config baseConfig(const WorldState& world) {
    CausalEffectEstimator::Config cfg;
    cfg.base_seed = world.scm_noise_seed != 0
        ? world.scm_noise_seed * 0x9E3779B1ull + 0x1234567ull
        : 0x5eed1234ull;
    cfg.replicates = 24;
    return cfg;
}

// Effect of restoring the degraded sensor on the mission, i.e. the do(sensor=restored)
// vs do(sensor=degraded) contrast that the sensor->detection->mission chain encodes.
CausalEffectEstimate chainRestoreEffect(
    const WorldState& world,
    const Snapshot* snapshot,
    Tick horizon_ticks) {
    CausalEffectEstimator estimator;
    CausalEffectEstimator::Config cfg = baseConfig(world);
    if (snapshot && horizon_ticks > 0) {
        return estimator.estimateInterventionEffect(
            *snapshot,
            {Intervention{InterventionType::IsolateCompromisedSensorFeed, 760, "blue_uas_1"}},
            horizon_ticks,
            cfg);
    }
    DetectionInputs control;
    control.degraded = true;
    DetectionInputs treated;
    treated.isolated = true;
    MissionInputs control_mission;
    MissionInputs treated_mission;
    treated_mission.isolated = true;
    return estimator.estimateStructuralContrast(
        world.scm, treated, treated_mission, control, control_mission,
        world.mission.target_detected_before_tick, cfg);
}

// Effect of removing the (non-causal) logistics delay. Structurally this changes
// nothing on the detection/mission path, so the estimated effect collapses to ~0.
CausalEffectEstimate logisticsEffect(
    const WorldState& world,
    const Snapshot* snapshot,
    Tick horizon_ticks) {
    CausalEffectEstimator estimator;
    CausalEffectEstimator::Config cfg = baseConfig(world);
    if (snapshot && horizon_ticks > 0) {
        return estimator.estimateInterventionEffect(
            *snapshot,
            {Intervention{InterventionType::RemoveLogisticsDelay, 760, "logistics_support_node"}},
            horizon_ticks,
            cfg);
    }
    DetectionInputs same;
    same.degraded = true;
    MissionInputs mission;
    return estimator.estimateStructuralContrast(
        world.scm, same, mission, same, mission,
        world.mission.target_detected_before_tick, cfg);
}

} // namespace

std::vector<CausalClaim> CausalClaimBuilder::build(
    const EventLedger& ledger,
    const WorldState& world,
    const CounterfactualResult* /*result*/,
    const Snapshot* snapshot,
    Tick horizon_ticks) {
    std::vector<CausalClaim> claims;

    const SimEvent* cyber = findEventByLabel(ledger, "red_cyber_degradation");
    if (!cyber) cyber = findEventByLabel(ledger, "comms_degradation");
    const SimEvent* sensor = findEventByLabel(ledger, "sensor_confidence_loss");
    const SimEvent* delay = findEventByLabel(ledger, "delayed_target_detection");
    const SimEvent* mission = findEventByLabel(ledger, "mission_failure");
    if (!mission) mission = findEventByLabel(ledger, "mission_recovery");
    const SimEvent* logistics = findEventByLabel(ledger, "logistics_delay_correlated_non_causal");

    // Do-calculus identification over the declared structural DAG. detection_time and
    // mission_success_score share an unobserved confounder (commander risk tolerance),
    // which downgrades that estimand to weakly identifiable.
    std::vector<std::pair<std::string, std::string>> latent_confounders;
    if (world.scm.latent_confounder_strength > 0.0) {
        latent_confounders.emplace_back("detection_time", "mission_success_score");
    }
    const CausalIdentifier identifier(world.planted_truth, latent_confounders);

    CausalEffectEstimator estimator;
    const CausalEffectEstimate chain = chainRestoreEffect(world, snapshot, horizon_ticks);

    if (cyber && sensor) {
        // cyber -> sensor: directly manipulated do()-variable with a directly observed
        // structural child; effect read straight from theta / the observed delta.
        const double coefficient = std::abs(world.scm.sensor_beta_cyber);
        const CausalEffectEstimate direct =
            estimator.estimateCoefficientEffect(coefficient, world.scm.sensor_sigma, baseConfig(world));

        CausalClaim claim;
        claim.cause = cyber->event_id;
        claim.effect = sensor->event_id;
        claim.cause_variable = "red_cyber_actor.degrade_sensor_feed";
        claim.effect_variable = "blue_uas_1.sensor.confidence";
        claim.status = ClaimStatus::DirectlyAdjudicated;
        claim.effect_size = coefficient;
        claim.confidence = direct.prob_positive;
        claim.sensitivity_to_assumptions = direct.sensitivity;
        claim.evidence = {cyber->event_id, sensor->event_id};
        claim.falsification_tests = {"restore sensor confidence while preserving comms degradation"};
        claim.label = claim.cause_variable + " -> " + claim.effect_variable;
        claims.push_back(claim);
    } else if (cyber) {
        const SimEvent* comms_path = findEventByLabel(ledger, "comms_path_degraded");
        if (comms_path) {
            double magnitude = observedDeltaMagnitude(*comms_path);
            if (magnitude <= 0.0) magnitude = std::abs(world.scm.sensor_beta_cyber);
            const CausalEffectEstimate direct =
                estimator.estimateCoefficientEffect(magnitude, world.scm.sensor_sigma, baseConfig(world));

            CausalClaim claim;
            claim.cause = cyber->event_id;
            claim.effect = comms_path->event_id;
            claim.cause_variable = "red_cyber_actor.degrade_comms_only";
            claim.effect_variable = "blue_relay_1.comms.latency_sec";
            claim.status = ClaimStatus::DirectlyAdjudicated;
            claim.effect_size = magnitude;
            claim.confidence = direct.prob_positive;
            claim.sensitivity_to_assumptions = direct.sensitivity;
            claim.evidence = {cyber->event_id, comms_path->event_id};
            claim.falsification_tests = {"restore comms relay while preserving sensor confidence"};
            claim.label = claim.cause_variable + " -> " + claim.effect_variable;
            claims.push_back(claim);
        }
    }

    if (sensor && (delay || world.metrics.detection_time > world.mission.target_detected_before_tick)) {
        const IdentificationResult id = identifier.identify("blue_uas_1.sensor.confidence", "detection_time");

        CausalClaim claim;
        claim.cause = sensor->event_id;
        claim.effect = delay ? delay->event_id : mission ? mission->event_id : sensor->event_id;
        claim.cause_variable = "blue_uas_1.sensor.confidence";
        claim.effect_variable = "detection_time";
        claim.status = id.status;
        claim.effect_size = chain.ate;
        claim.confidence = chain.prob_positive;
        claim.sensitivity_to_assumptions = chain.sensitivity;
        claim.evidence = delay ? std::vector<EventId>{sensor->event_id, delay->event_id} : std::vector<EventId>{sensor->event_id};
        claim.confounders = id.adjustment_set.empty() ? std::vector<std::string>{"logistics.delay"} : id.adjustment_set;
        claim.falsification_tests = {"restore comms but keep sensor confidence degraded", "restore sensor confidence but keep comms degraded"};
        claim.label = "sensor_confidence_loss -> delayed_detection";
        claims.push_back(claim);
    }

    if ((delay || world.metrics.detection_time > 0) && mission) {
        const IdentificationResult id = identifier.identify("detection_time", "mission_success_score");

        // Same do() ensemble as the chain, but the unobserved confounder inflates the
        // sensitivity (E-value robustness + latent penalty).
        const double latent_sensitivity = std::clamp(
            chain.sensitivity + world.scm.latent_confounder_strength, 0.0, 1.0);

        CausalClaim claim;
        claim.cause = delay ? delay->event_id : sensor ? sensor->event_id : mission->event_id;
        claim.effect = mission->event_id;
        claim.cause_variable = "detection_time";
        claim.effect_variable = "mission_success_score";
        claim.status = id.status;
        claim.effect_size = chain.ate;
        claim.confidence = chain.prob_positive;
        claim.sensitivity_to_assumptions = latent_sensitivity;
        claim.evidence = {claim.cause, mission->event_id};
        claim.confounders = id.latent_confounders.empty()
            ? std::vector<std::string>{"commander.risk_tolerance"}
            : id.latent_confounders;
        claim.falsification_tests = {"vary commander risk tolerance", "change adversary timing"};
        claim.label = "delayed_detection -> mission_failure";
        claims.push_back(claim);
    }

    if (logistics && mission) {
        const IdentificationResult id = identifier.identify("logistics.delay", "mission_success_score");
        const CausalEffectEstimate log_effect = logisticsEffect(world, snapshot, horizon_ticks);

        CausalClaim claim;
        claim.cause = logistics->event_id;
        claim.effect = mission->event_id;
        claim.cause_variable = "logistics.delay";
        claim.effect_variable = "mission_success_score";
        claim.status = id.status;
        claim.effect_size = log_effect.ate;
        claim.confidence = log_effect.prob_positive;
        claim.sensitivity_to_assumptions = log_effect.sensitivity;
        claim.evidence = {logistics->event_id};
        claim.confounders = {"red_cyber_actor.degrade_sensor_feed", "blue_uas_1.sensor.confidence"};
        claim.falsification_tests = {"hold logistics delay fixed across intervention branch"};
        claim.label = "logistics_delay -> mission_failure rejected";
        claims.push_back(claim);
    }

    return claims;
}

} // namespace darla
