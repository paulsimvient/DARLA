#include "sim-causal/CausalEffectEstimator.h"

#include <algorithm>
#include <cmath>
#include <numeric>
#include <random>

namespace darla {
namespace {

double mean(const std::vector<double>& values) {
    if (values.empty()) return 0.0;
    return std::accumulate(values.begin(), values.end(), 0.0) / static_cast<double>(values.size());
}

double sampleStdDev(const std::vector<double>& values, double mu) {
    if (values.size() < 2) return 0.0;
    double sum_sq = 0.0;
    for (double v : values) sum_sq += (v - mu) * (v - mu);
    return std::sqrt(sum_sq / static_cast<double>(values.size() - 1));
}

double quantile(std::vector<double> sorted, double q) {
    if (sorted.empty()) return 0.0;
    std::sort(sorted.begin(), sorted.end());
    const double pos = q * static_cast<double>(sorted.size() - 1);
    const std::size_t lo = static_cast<std::size_t>(std::floor(pos));
    const std::size_t hi = static_cast<std::size_t>(std::ceil(pos));
    if (lo == hi) return sorted[lo];
    const double frac = pos - static_cast<double>(lo);
    return sorted[lo] * (1.0 - frac) + sorted[hi] * frac;
}

} // namespace

MissionMetrics CausalEffectEstimator::runBranch(
    const Snapshot& snapshot,
    const std::vector<Intervention>& interventions,
    Tick horizon_ticks,
    std::uint64_t noise_seed) const {
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
    kernel.runUntil(horizon_ticks);
    return kernel.world().metrics;
}

double CausalEffectEstimator::eValueFromStandardizedEffect(double standardized_effect) {
    // Convert a standardized mean difference to an approximate risk ratio (Chinn 2000),
    // then to the VanderWeele E-value: the minimum strength of unobserved confounding
    // (on the risk-ratio scale) that could explain away the observed effect.
    const double rr = std::exp(0.91 * std::abs(standardized_effect));
    if (rr <= 1.0) return 1.0;
    return rr + std::sqrt(rr * (rr - 1.0));
}

void CausalEffectEstimator::fillUncertainty(
    std::vector<double> diffs,
    const Config& config,
    CausalEffectEstimate& estimate) {
    estimate.replicates = static_cast<int>(diffs.size());
    if (diffs.empty()) return;

    const double mu = mean(diffs);
    const double sd = sampleStdDev(diffs, mu);
    estimate.ate = mu;
    estimate.std_error = diffs.size() > 1 ? sd / std::sqrt(static_cast<double>(diffs.size())) : 0.0;

    // Nonparametric bootstrap of the mean for the CI and the calibrated P(tau>0).
    std::mt19937_64 rng(config.base_seed ^ 0x9E3779B97F4A7C15ull);
    std::uniform_int_distribution<std::size_t> pick(0, diffs.size() - 1);
    std::vector<double> boot_means;
    boot_means.reserve(static_cast<std::size_t>(config.bootstrap_resamples));
    std::size_t positive = 0;
    for (int b = 0; b < config.bootstrap_resamples; ++b) {
        double sum = 0.0;
        for (std::size_t i = 0; i < diffs.size(); ++i) sum += diffs[pick(rng)];
        const double bm = sum / static_cast<double>(diffs.size());
        boot_means.push_back(bm);
        if (bm > 0.0) ++positive;
    }
    const double tail = (1.0 - config.ci_mass) / 2.0;
    estimate.ci_low = quantile(boot_means, tail);
    estimate.ci_high = quantile(boot_means, 1.0 - tail);
    estimate.prob_positive = static_cast<double>(positive) / static_cast<double>(boot_means.size());

    const double standardized = sd > 1e-9 ? mu / sd : (mu > 0 ? 6.0 : 0.0);
    estimate.e_value = eValueFromStandardizedEffect(standardized);
    const double robustness = estimate.e_value > 1.0 ? 1.0 / estimate.e_value : 1.0;
    estimate.sensitivity = std::clamp(robustness + config.latent_penalty, 0.0, 1.0);
}

CausalEffectEstimate CausalEffectEstimator::estimateInterventionEffect(
    const Snapshot& snapshot,
    const std::vector<Intervention>& treatment,
    Tick horizon_ticks,
    Config config) const {
    CausalEffectEstimate estimate;
    estimate.monte_carlo = true;

    std::vector<double> diffs;
    diffs.reserve(static_cast<std::size_t>(config.replicates));
    std::vector<double> detection_diffs;
    detection_diffs.reserve(static_cast<std::size_t>(config.replicates));

    for (int n = 0; n < config.replicates; ++n) {
        // Independent exogenous-noise draws for the control and treated branches so the
        // paired difference carries genuine sampling variance (no common-random-number
        // cancellation), giving a non-degenerate bootstrap interval.
        const std::uint64_t control_seed = config.base_seed + 2ull * static_cast<std::uint64_t>(n);
        const std::uint64_t treated_seed = control_seed + 1ull;
        const MissionMetrics control = runBranch(snapshot, {}, horizon_ticks, control_seed);
        const MissionMetrics treated = runBranch(snapshot, treatment, horizon_ticks, treated_seed);
        diffs.push_back(treated.mission_success_score - control.mission_success_score);
        detection_diffs.push_back(
            static_cast<double>(control.detection_time) - static_cast<double>(treated.detection_time));
    }

    fillUncertainty(diffs, config, estimate);
    estimate.detection_effect_ticks = mean(detection_diffs);
    return estimate;
}

CausalEffectEstimate CausalEffectEstimator::estimateStructuralContrast(
    const ScmParameters& params,
    const DetectionInputs& treated,
    const MissionInputs& treated_mission,
    const DetectionInputs& control,
    const MissionInputs& control_mission,
    Tick cutoff,
    Config config) const {
    const StructuralCausalModel scm(params);

    const double p_treated = scm.probabilityDetectBeforeCutoff(treated, cutoff);
    const double p_control = scm.probabilityDetectBeforeCutoff(control, cutoff);
    const double m_treated = scm.expectedMissionScore(treated_mission, p_treated);
    const double m_control = scm.expectedMissionScore(control_mission, p_control);

    // Variance of a two-point (success/fail) mixture plus structural mission noise.
    auto missionVariance = [&](const MissionInputs& ctx, double p) {
        MissionInputs s = ctx; s.success = true;
        MissionInputs f = ctx; f.success = false;
        const double spread = scm.missionScoreMean(s) - scm.missionScoreMean(f);
        return p * (1.0 - p) * spread * spread + params.mission_sigma * params.mission_sigma;
    };

    CausalEffectEstimate estimate;
    estimate.monte_carlo = false;
    estimate.replicates = 0;
    estimate.ate = m_treated - m_control;
    const double var = missionVariance(treated_mission, p_treated) + missionVariance(control_mission, p_control);
    const double sd = std::sqrt(std::max(var, 1e-12));
    estimate.std_error = sd;

    // Two-sided normal critical value for the requested mass.
    const double crit = config.ci_mass >= 0.99 ? 2.576
                       : config.ci_mass >= 0.95 ? 1.960
                       : config.ci_mass >= 0.90 ? 1.645
                       : 1.0;
    estimate.ci_low = estimate.ate - crit * sd;
    estimate.ci_high = estimate.ate + crit * sd;
    estimate.prob_positive = normalCdf(estimate.ate / sd);

    const double standardized = estimate.ate / sd;
    estimate.e_value = eValueFromStandardizedEffect(standardized);
    const double robustness = estimate.e_value > 1.0 ? 1.0 / estimate.e_value : 1.0;
    estimate.sensitivity = std::clamp(robustness + config.latent_penalty, 0.0, 1.0);
    estimate.detection_effect_ticks =
        static_cast<double>(scm.detectionTickMean(control)) - static_cast<double>(scm.detectionTickMean(treated));
    return estimate;
}

CausalEffectEstimate CausalEffectEstimator::estimateCoefficientEffect(
    double coefficient,
    double sigma,
    Config config) const {
    CausalEffectEstimate estimate;
    estimate.monte_carlo = false;
    estimate.ate = coefficient;
    const double sd = std::max(std::abs(sigma), 1e-9);
    estimate.std_error = sd;
    const double crit = config.ci_mass >= 0.95 ? 1.960 : config.ci_mass >= 0.90 ? 1.645 : 1.0;
    estimate.ci_low = coefficient - crit * sd;
    estimate.ci_high = coefficient + crit * sd;
    const double standardized = coefficient / sd;
    estimate.prob_positive = normalCdf(std::abs(standardized));
    estimate.e_value = eValueFromStandardizedEffect(standardized);
    const double robustness = estimate.e_value > 1.0 ? 1.0 / estimate.e_value : 1.0;
    estimate.sensitivity = std::clamp(robustness + config.latent_penalty, 0.0, 1.0);
    return estimate;
}

} // namespace darla
