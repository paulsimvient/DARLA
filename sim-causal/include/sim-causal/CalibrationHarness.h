#pragma once

#include "WorldState.h"
#include "sim-causal/PlantedTruthScorer.h"

#include <cstdint>
#include <string>
#include <vector>

namespace darla {

struct ReliabilityBin {
    double mean_predicted = 0.0;
    double mean_observed = 0.0;
    int count = 0;
};

// Output of the multi-seed calibration + accuracy harness.
struct CalibrationReport {
    // Probability calibration of the predicted P(mission success) against realized outcomes.
    double brier_score = 0.0;
    double log_loss = 0.0;
    double expected_calibration_error = 0.0;
    std::vector<ReliabilityBin> reliability;
    int outcome_samples = 0;

    // Effect-estimate accuracy / interval calibration of the chain intervention effect.
    double true_effect = 0.0;
    double mean_estimated_effect = 0.0;
    double mean_ci_width = 0.0;
    double ci_coverage = 0.0;     // fraction of CI experiments whose interval covers the true effect
    int ci_experiments = 0;

    // Planted-DAG graph recovery + effect accuracy.
    PlantedTruthScore recovery;

    // Derived credibility-contract numbers.
    double calibration_error = 0.0; // == expected_calibration_error
    double validation_score = 0.0;  // == recovery.f1
    double uncertainty_score = 0.0; // miscoverage + mean interval half-width
};

struct CalibrationConfig {
    int outcome_seeds = 120;     // seeds per regime for Brier/log-loss/ECE
    int ci_experiments = 24;     // independent confidence-interval experiments
    int ci_replicates = 24;      // Monte-Carlo replicates per CI experiment
    int reliability_bins = 10;
    std::uint64_t base_seed = 1000;
    double ci_mass = 0.90;
    Tick intervention_tick = 760;
};

// Runs the SCM against the scenario's planted truth across many seeds and reports
// probability calibration, interval coverage, and graph/effect recovery.
class CalibrationHarness {
public:
    CalibrationReport run(const Scenario& scenario, CalibrationConfig config = {}) const;
};

} // namespace darla
