#pragma once

#include "SimulationKernel.h"
#include "StructuralCausalModel.h"
#include "sim-causal/InterventionEngine.h"

#include <cstdint>
#include <vector>

namespace darla {

// A Monte-Carlo / closed-form estimate of an interventional contrast tau, with the
// uncertainty quantification a credibility report needs.
struct CausalEffectEstimate {
    double ate = 0.0;            // point estimate of tau (effect on mission_success_score)
    double std_error = 0.0;      // standard error of tau_hat
    double ci_low = 0.0;         // lower bootstrap/closed-form confidence bound
    double ci_high = 0.0;        // upper confidence bound
    double prob_positive = 0.5;  // calibrated P(tau > 0)
    double e_value = 1.0;        // VanderWeele/Rosenbaum E-value (robustness to unobserved confounding)
    double sensitivity = 0.0;    // sensitivity_to_assumptions in [0,1] (1 == fragile)
    double detection_effect_ticks = 0.0; // mean (control_detection - treated_detection)
    int replicates = 0;
    bool monte_carlo = false;    // true if estimated by simulation, false if closed-form SCM
};

struct EffectEstimatorConfig {
    int replicates = 24;
    int bootstrap_resamples = 400;
    std::uint64_t base_seed = 0x5eed1234ull;
    double ci_mass = 0.90;
    // Added to the derived sensitivity when a latent confounder is known to bias the
    // estimand (e.g. detection_time -> mission_success_score).
    double latent_penalty = 0.0;
};

class CausalEffectEstimator {
public:
    using Config = EffectEstimatorConfig;

    // Monte-Carlo ATE over seeded do() branches. For each replicate a paired control
    // (no intervention) and treated branch are run from the same snapshot with SCM
    // exogenous noise enabled under a shared sub-seed, so the difference isolates the
    // intervention. Bootstrap gives the CI and the calibrated P(tau>0); a Chinn/E-value
    // transform gives the robustness-to-unobserved-confounding sensitivity.
    CausalEffectEstimate estimateInterventionEffect(
        const Snapshot& snapshot,
        const std::vector<Intervention>& treatment,
        Tick horizon_ticks,
        Config config = {}) const;

    // Closed-form SCM contrast E[M | treated] - E[M | control] using the Gaussian
    // detection-threshold model; used when no executable snapshot is available.
    CausalEffectEstimate estimateStructuralContrast(
        const ScmParameters& params,
        const DetectionInputs& treated,
        const MissionInputs& treated_mission,
        const DetectionInputs& control,
        const MissionInputs& control_mission,
        Tick cutoff,
        Config config = {}) const;

    // Direct structural-coefficient effect (e.g. cyber -> sensor), with
    // P(|effect|>0) under the coefficient's Gaussian noise.
    CausalEffectEstimate estimateCoefficientEffect(
        double coefficient,
        double sigma,
        Config config = {}) const;

private:
    MissionMetrics runBranch(
        const Snapshot& snapshot,
        const std::vector<Intervention>& interventions,
        Tick horizon_ticks,
        std::uint64_t noise_seed) const;

    static void fillUncertainty(
        std::vector<double> diffs,
        const Config& config,
        CausalEffectEstimate& estimate);
    static double eValueFromStandardizedEffect(double standardized_effect);
};

} // namespace darla
