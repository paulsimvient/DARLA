#pragma once

#include "sim-causal/CausalClaim.h"

#include "WorldState.h"

#include <string>
#include <vector>

namespace darla {

struct PlantedTruthScore {
    // recovery_score == edge recall: matched planted edges / total planted edges
    double recovery_score = 0.0;
    std::vector<std::string> matched_edges;
    std::vector<std::string> missing_edges;
    std::vector<std::string> extra_edges; // recovered claims not in planted graph (precision proxy)

    // Graph-recovery metrics against the planted DAG.
    double precision = 0.0;  // matched / (matched + extra)
    double recall = 0.0;     // matched / (matched + missing) == recovery_score
    double f1 = 0.0;         // harmonic mean of precision and recall
    int structural_hamming_distance = 0; // missing + extra (+ reversed) edges
    double sign_accuracy = 1.0; // fraction of matched edges with the expected effect sign

    // Effect-accuracy metrics (populated only when planted effects + estimates are supplied).
    double mean_abs_effect_error = 0.0; // mean |tau_hat - tau_true| over matched edges
    double ci_coverage = 0.0;           // fraction of true effects inside the reported CI
    int effect_samples = 0;             // number of edges contributing to effect metrics
};

// A planted ground-truth effect for one edge plus the estimate produced for it,
// used to score effect-accuracy and confidence-interval coverage.
struct EffectAccuracySample {
    std::string edge;       // canonical "cause -> effect"
    double true_effect = 0.0;
    double estimated_effect = 0.0;
    double ci_low = 0.0;
    double ci_high = 0.0;
};

class PlantedTruthScorer {
public:
    PlantedTruthScore score(const std::vector<PlantedCausalEdge>& planted, const std::vector<CausalClaim>& claims) const;

    // Augments a graph-recovery score with effect-accuracy and CI-coverage metrics.
    void scoreEffectAccuracy(PlantedTruthScore& score, const std::vector<EffectAccuracySample>& samples) const;
};

} // namespace darla
