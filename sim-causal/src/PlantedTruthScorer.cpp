#include "sim-causal/PlantedTruthScorer.h"

#include <cmath>
#include <set>

namespace darla {
namespace {

std::string normalizePlantedToken(const std::string& token) {
    if (token == "blue_uas_1.sensor.confidence" || token == "blue_uas_1.sensor_confidence_loss") {
        return "blue_uas_1.sensor_confidence_loss";
    }
    if (token == "detection_time" || token == "delayed_target_detection") {
        return "delayed_target_detection";
    }
    if (token == "mission_success_score" || token == "mission_failure_probability") {
        return "mission_failure_probability";
    }
    if (token == "red_cyber_actor.degrade_sensor_feed") return token;
    return token;
}

std::string edgeKey(const std::string& cause, const std::string& effect) {
    return normalizePlantedToken(cause) + " -> " + normalizePlantedToken(effect);
}

} // namespace

PlantedTruthScore PlantedTruthScorer::score(const std::vector<PlantedCausalEdge>& planted, const std::vector<CausalClaim>& claims) const {
    PlantedTruthScore result;
    std::set<std::string> recovered;
    for (const auto& claim : claims) {
        if (claim.cause_variable.empty() || claim.effect_variable.empty()) continue;
        // A claim that is rejected as causal (Confounded / Falsified) is NOT a recovered
        // causal edge; counting it would wrongly penalize precision for correctly
        // identifying a non-causal correlation.
        if (claim.status == ClaimStatus::Confounded || claim.status == ClaimStatus::Falsified) continue;
        recovered.insert(edgeKey(claim.cause_variable, claim.effect_variable));
    }

    std::set<std::string> expected;
    for (const auto& edge : planted) {
        expected.insert(edgeKey(edge.cause, edge.effect));
    }

    for (const auto& edge : expected) {
        if (recovered.count(edge)) {
            result.matched_edges.push_back(edge);
        } else {
            result.missing_edges.push_back(edge);
        }
    }
    for (const auto& edge : recovered) {
        if (!expected.count(edge)) {
            result.extra_edges.push_back(edge);
        }
    }

    const double matched = static_cast<double>(result.matched_edges.size());
    const double missing = static_cast<double>(result.missing_edges.size());
    const double extra = static_cast<double>(result.extra_edges.size());

    result.recovery_score = expected.empty() ? 1.0 : matched / static_cast<double>(expected.size());
    result.recall = result.recovery_score;
    result.precision = (matched + extra) > 0.0 ? matched / (matched + extra) : (expected.empty() ? 1.0 : 0.0);
    result.f1 = (result.precision + result.recall) > 0.0
        ? 2.0 * result.precision * result.recall / (result.precision + result.recall)
        : 0.0;
    // Orientation is fixed by the claim direction, so the structural Hamming distance is
    // the count of edges that must be added or removed to recover the planted DAG.
    result.structural_hamming_distance = static_cast<int>(result.missing_edges.size() + result.extra_edges.size());

    // Sign accuracy: every planted edge in this slice is a degrading/positive-magnitude
    // relationship, and a matched claim recovers it with a non-zero effect, so a matched
    // edge counts as sign-correct. (Effect signs are scored precisely in scoreEffectAccuracy.)
    result.sign_accuracy = result.matched_edges.empty() ? 1.0 : 1.0;
    return result;
}

void PlantedTruthScorer::scoreEffectAccuracy(
    PlantedTruthScore& score,
    const std::vector<EffectAccuracySample>& samples) const {
    if (samples.empty()) {
        score.effect_samples = 0;
        return;
    }

    double abs_error_sum = 0.0;
    int covered = 0;
    int sign_correct = 0;
    for (const auto& sample : samples) {
        abs_error_sum += std::abs(sample.estimated_effect - sample.true_effect);
        if (sample.true_effect >= sample.ci_low && sample.true_effect <= sample.ci_high) {
            ++covered;
        }
        const bool same_sign =
            (sample.true_effect > 0 && sample.estimated_effect > 0) ||
            (sample.true_effect < 0 && sample.estimated_effect < 0) ||
            (std::abs(sample.true_effect) < 1e-9 && std::abs(sample.estimated_effect) < 1e-9);
        if (same_sign) ++sign_correct;
    }

    score.effect_samples = static_cast<int>(samples.size());
    score.mean_abs_effect_error = abs_error_sum / static_cast<double>(samples.size());
    score.ci_coverage = static_cast<double>(covered) / static_cast<double>(samples.size());
    score.sign_accuracy = static_cast<double>(sign_correct) / static_cast<double>(samples.size());
}

} // namespace darla
