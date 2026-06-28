#pragma once

#include "Types.h"

#include <cstdint>

namespace darla {

// Parameters theta of the structural causal model (SCM) for the
// cyber -> sensor_confidence -> detection_time -> mission_success slice.
//
// The defaults are chosen so that the deterministic (noise-free) structural
// means reproduce the legacy hand-tuned ladder exactly:
//   isolated+autonomous -> 1320, isolated -> 1440, degraded+autonomous -> 1700,
//   degraded -> 1980, comms-blocking -> 1900, nominal -> 1400; mission scores
//   0.42 (fail) / 0.61 / 0.68 / 0.67-floor. This keeps deterministic replay
//   hashes stable while exposing theta for inspection, estimation, and noise.
struct ScmParameters {
    // Sensor structural equation: S = clip(S0 + beta_cyber * X + U_S, 0, 1).
    double sensor_beta_cyber = -0.45;   // matches scripted sensor_confidence_delta
    double sensor_sigma = 0.05;         // exogenous noise sd on sensor confidence

    // Detection structural equation mean components (ticks).
    double detection_nominal = 1400.0;
    double detection_comms_blocking = 1900.0;
    double detection_degraded = 1980.0;
    double detection_degraded_autonomous = 1700.0;
    double detection_isolated = 1440.0;
    double detection_isolated_autonomous = 1320.0;
    double detection_sigma = 60.0;      // exogenous noise sd on detection time (ticks)

    // Mission structural equation.
    double mission_fail_score = 0.42;
    double mission_success_score = 0.61;
    double mission_success_autonomous_isolated = 0.68;
    double mission_preauth_floor = 0.67;
    double mission_sigma = 0.05;        // exogenous noise sd on mission score

    // Strength of the latent (unobserved) confounder coupling detection_time and
    // mission_success_score (commander risk tolerance / shared tempo noise). Used
    // by identification to downgrade detection->mission to weakly identifiable and
    // by sensitivity analysis; it does not perturb the deterministic baseline.
    double latent_confounder_strength = 0.18;
};

// Discrete structural inputs to the detection-time equation.
struct DetectionInputs {
    bool degraded = false;
    bool isolated = false;       // sensor isolation that is causally relevant
    bool autonomous = false;
    bool comms_blocking = false;
};

// Discrete structural inputs to the mission-score equation.
struct MissionInputs {
    bool success = false;
    bool autonomous = false;
    bool isolated = false;
    bool preauthorized = false;
    bool high_confidence = false;
};

class StructuralCausalModel {
public:
    StructuralCausalModel() = default;
    explicit StructuralCausalModel(ScmParameters params) : params_(params) {}

    const ScmParameters& params() const { return params_; }

    // Deterministic structural means (exogenous noise U = 0). These reproduce the
    // legacy ladder/scores exactly and drive the in-world baseline simulation.
    Tick detectionTickMean(const DetectionInputs& in) const;
    double missionScoreMean(const MissionInputs& in) const;

    // Stochastic structural evaluation: draws exogenous noise deterministically
    // from (noise_seed, stream) so each Monte-Carlo replicate is reproducible.
    Tick detectionTick(const DetectionInputs& in, std::uint64_t noise_seed, std::uint64_t stream) const;
    double missionScore(const MissionInputs& in, std::uint64_t noise_seed, std::uint64_t stream) const;

    // Closed-form probability that detection beats the mission cutoff under the
    // Gaussian detection-noise model: P(D <= cutoff) = Phi((cutoff - mu_D)/sigma_D).
    double probabilityDetectBeforeCutoff(const DetectionInputs& in, Tick cutoff) const;

    // Expected mission score E[M] = P(success) * score_success + (1-P) * score_fail
    // for the given structural mission inputs and success probability.
    double expectedMissionScore(const MissionInputs& inputs, double success_probability) const;

private:
    ScmParameters params_;
};

// Standard-normal sample drawn deterministically from a 64-bit seed and stream id
// (splitmix64 mixing + Box-Muller). Pure function: identical inputs -> identical draw.
double scmGaussian(std::uint64_t seed, std::uint64_t stream);

// Standard-normal CDF Phi(z).
double normalCdf(double z);

} // namespace darla
