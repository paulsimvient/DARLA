#include "sim-causal/CalibrationHarness.h"

#include "SimulationKernel.h"
#include "Snapshot.h"
#include "StructuralCausalModel.h"
#include "sim-causal/CausalClaimBuilder.h"
#include "sim-causal/CausalEffectEstimator.h"
#include "sim-causal/Identification.h"
#include "sim-causal/InterventionEngine.h"

#include <algorithm>
#include <cmath>
#include <string>
#include <vector>

namespace darla {
namespace {

struct Regime {
    std::string label;
    DetectionInputs inputs;
    std::vector<Intervention> interventions;
};

double clipProbability(double p) {
    return std::clamp(p, 1e-6, 1.0 - 1e-6);
}

// Run the scenario (no agents) until the scripted cyber degradation lands, returning
// that snapshot. This is the deterministic, noise-free state every branch forks from.
Snapshot captureDegradationSnapshot(const Scenario& scenario) {
    SimulationKernel kernel;
    kernel.loadScenario(scenario);
    Snapshot snapshot;
    bool captured = false;
    while (kernel.world().tick < scenario.config.max_ticks) {
        kernel.step();
        if (!captured && kernel.world().cyber_degradation_applied) {
            snapshot = kernel.snapshot();
            captured = true;
        }
        if (captured && kernel.world().tick > snapshot.world.tick + 5) break;
    }
    if (!captured) snapshot = kernel.snapshot();
    return snapshot;
}

// Run the scenario to completion (no agents, no noise) so the ledger contains the full
// detection/mission causal chain for graph-recovery scoring.
Snapshot runFullBaseline(const Scenario& scenario) {
    SimulationKernel kernel;
    kernel.loadScenario(scenario);
    while (kernel.world().tick < scenario.config.max_ticks) {
        kernel.step();
    }
    return kernel.snapshot();
}

// Run one noisy branch from the snapshot with the given interventions scheduled.
MissionMetrics runBranch(
    const Snapshot& snapshot,
    const std::vector<Intervention>& interventions,
    Tick horizon,
    std::uint64_t noise_seed) {
    Snapshot branch = snapshot;
    branch.world.realtime_agents_enabled = false;
    branch.world.agent_runtime = {};
    branch.world.agent_beliefs.commander.primary_decision_recorded = false;
    branch.world.scm_noise_enabled = true;
    branch.world.scm_noise_seed = noise_seed;
    for (const auto& intervention : interventions) {
        branch.world.scheduled_interventions.push_back(
            ScheduledIntervention{toString(intervention.type), intervention.at_tick, intervention.target, false});
    }
    SimulationKernel kernel;
    kernel.initialize(SimConfig{});
    kernel.restore(branch);
    kernel.runUntil(horizon);
    return kernel.world().metrics;
}

} // namespace

CalibrationReport CalibrationHarness::run(const Scenario& scenario, CalibrationConfig config) const {
    CalibrationReport report;
    const StructuralCausalModel scm(scenario.scm);
    const Tick cutoff = scenario.mission.target_detected_before_tick;
    const Tick horizon = scenario.config.max_ticks;
    const Snapshot snapshot = captureDegradationSnapshot(scenario);

    // --- Probability calibration over intervention regimes ---------------------------
    std::vector<Regime> regimes;
    {
        Regime none; none.label = "no_intervention"; none.inputs.degraded = true; regimes.push_back(none);
        Regime iso; iso.label = "isolate_sensor"; iso.inputs.isolated = true;
        iso.interventions.push_back(Intervention{InterventionType::IsolateCompromisedSensorFeed, config.intervention_tick, "blue_uas_1"});
        regimes.push_back(iso);
        Regime au; au.label = "autonomous_search"; au.inputs.degraded = true; au.inputs.autonomous = true;
        au.interventions.push_back(Intervention{InterventionType::EnableAutonomousSearch, config.intervention_tick, "blue_uas_1"});
        regimes.push_back(au);
        Regime both; both.label = "isolate_autonomous"; both.inputs.isolated = true; both.inputs.autonomous = true;
        both.interventions.push_back(Intervention{InterventionType::IsolateCompromisedSensorFeed, config.intervention_tick, "blue_uas_1"});
        both.interventions.push_back(Intervention{InterventionType::EnableAutonomousSearch, config.intervention_tick, "blue_uas_1"});
        regimes.push_back(both);
    }

    std::vector<double> bin_pred_sum(static_cast<std::size_t>(config.reliability_bins), 0.0);
    std::vector<double> bin_obs_sum(static_cast<std::size_t>(config.reliability_bins), 0.0);
    std::vector<int> bin_count(static_cast<std::size_t>(config.reliability_bins), 0);

    double brier_sum = 0.0;
    double log_loss_sum = 0.0;
    int samples = 0;
    std::uint64_t seed_cursor = config.base_seed;
    for (const auto& regime : regimes) {
        const double predicted = scm.probabilityDetectBeforeCutoff(regime.inputs, cutoff);
        const double p = clipProbability(predicted);
        for (int s = 0; s < config.outcome_seeds; ++s) {
            const MissionMetrics metrics = runBranch(snapshot, regime.interventions, horizon, seed_cursor++);
            const double y = metrics.mission_success ? 1.0 : 0.0;
            brier_sum += (predicted - y) * (predicted - y);
            log_loss_sum += -(y * std::log(p) + (1.0 - y) * std::log(1.0 - p));
            ++samples;

            int bin = static_cast<int>(predicted * config.reliability_bins);
            if (bin >= config.reliability_bins) bin = config.reliability_bins - 1;
            if (bin < 0) bin = 0;
            bin_pred_sum[static_cast<std::size_t>(bin)] += predicted;
            bin_obs_sum[static_cast<std::size_t>(bin)] += y;
            bin_count[static_cast<std::size_t>(bin)] += 1;
        }
    }

    report.outcome_samples = samples;
    if (samples > 0) {
        report.brier_score = brier_sum / samples;
        report.log_loss = log_loss_sum / samples;
        double ece = 0.0;
        for (std::size_t b = 0; b < bin_count.size(); ++b) {
            if (bin_count[b] == 0) continue;
            const double mp = bin_pred_sum[b] / bin_count[b];
            const double mo = bin_obs_sum[b] / bin_count[b];
            ece += (static_cast<double>(bin_count[b]) / samples) * std::abs(mp - mo);
            report.reliability.push_back(ReliabilityBin{mp, mo, bin_count[b]});
        }
        report.expected_calibration_error = ece;
    }

    // --- Confidence-interval coverage for the chain intervention effect --------------
    CausalEffectEstimator estimator;
    DetectionInputs control; control.degraded = true;
    DetectionInputs treated; treated.isolated = true;
    MissionInputs control_mission;
    MissionInputs treated_mission; treated_mission.isolated = true;
    const CausalEffectEstimate truth = estimator.estimateStructuralContrast(
        scenario.scm, treated, treated_mission, control, control_mission, cutoff);
    report.true_effect = truth.ate;

    int covered = 0;
    double estimate_sum = 0.0;
    double width_sum = 0.0;
    for (int k = 0; k < config.ci_experiments; ++k) {
        EffectEstimatorConfig cfg;
        cfg.replicates = config.ci_replicates;
        cfg.ci_mass = config.ci_mass;
        cfg.base_seed = config.base_seed + 7919ull * static_cast<std::uint64_t>(k + 1);
        const CausalEffectEstimate est = estimator.estimateInterventionEffect(
            snapshot,
            {Intervention{InterventionType::IsolateCompromisedSensorFeed, config.intervention_tick, "blue_uas_1"}},
            horizon,
            cfg);
        if (report.true_effect >= est.ci_low && report.true_effect <= est.ci_high) ++covered;
        estimate_sum += est.ate;
        width_sum += (est.ci_high - est.ci_low);
    }
    report.ci_experiments = config.ci_experiments;
    if (config.ci_experiments > 0) {
        report.ci_coverage = static_cast<double>(covered) / config.ci_experiments;
        report.mean_estimated_effect = estimate_sum / config.ci_experiments;
        report.mean_ci_width = width_sum / config.ci_experiments;
    }

    // --- Planted-DAG recovery + effect accuracy --------------------------------------
    const Snapshot full_run = runFullBaseline(scenario);
    const auto claims = CausalClaimBuilder::build(full_run.ledger, full_run.world);
    PlantedTruthScorer scorer;
    report.recovery = scorer.score(scenario.planted_causal_truth, claims);

    std::vector<EffectAccuracySample> effect_samples;
    for (const auto& claim : claims) {
        if (claim.status == ClaimStatus::Confounded || claim.status == ClaimStatus::Falsified) continue;
        if (claim.effect_variable != "detection_time" && claim.effect_variable != "mission_success_score") continue;
        EffectAccuracySample sample;
        sample.edge = CausalIdentifier::canonical(claim.cause_variable) + " -> " +
                      CausalIdentifier::canonical(claim.effect_variable);
        sample.true_effect = report.true_effect;
        sample.estimated_effect = claim.effect_size;
        // Reconstruct the reported interval from the analytic SCM contrast.
        const double half = truth.std_error * (config.ci_mass >= 0.95 ? 1.96 : 1.645);
        sample.ci_low = claim.effect_size - half;
        sample.ci_high = claim.effect_size + half;
        effect_samples.push_back(sample);
    }
    scorer.scoreEffectAccuracy(report.recovery, effect_samples);

    // --- Derived credibility-contract numbers ----------------------------------------
    report.calibration_error = report.expected_calibration_error;
    report.validation_score = report.recovery.f1;
    report.uncertainty_score = std::clamp(
        std::abs(report.ci_coverage - config.ci_mass) + 0.5 * report.mean_ci_width, 0.0, 1.0);
    return report;
}

} // namespace darla
