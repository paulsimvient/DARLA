#include "sim-causal/CausalClaimBuilder.h"
#include "sim-causal/InterventionEngine.h"
#include "sim-causal/PlantedTruthScorer.h"
#include "sim-credibility/CredibilityEngine.h"
#include "sim-tools/ScenarioRunner.h"

#include <filesystem>
#include <iomanip>
#include <iostream>
#include <optional>
#include <stdexcept>

using namespace darla;

int main(int argc, char** argv) {
    try {
        if (argc < 2) {
            std::cerr << "usage: sim-verify <scenario.yaml> [--seed N]\n";
            return 2;
        }

        std::optional<std::uint64_t> seed_override;
        for (int i = 2; i + 1 < argc; ++i) {
            if (std::string(argv[i]) == "--seed") {
                seed_override = std::stoull(argv[i + 1]);
            }
        }

        const auto first = runScenarioFile(std::filesystem::path(argv[1]), seed_override);
        const auto second = runScenarioFile(std::filesystem::path(argv[1]), seed_override);

        std::string integrity_error;
        if (!first.kernel.events().validateIntegrity(&integrity_error)) {
            throw std::runtime_error("ledger integrity failed: " + integrity_error);
        }
        if (first.kernel.events().stableHash() != second.kernel.events().stableHash()) {
            throw std::runtime_error("deterministic replay hash mismatch");
        }
        if (first.kernel.world().metrics.detection_time != second.kernel.world().metrics.detection_time) {
            throw std::runtime_error("deterministic replay metric mismatch");
        }

        std::cout << "Scenario verification: passed\n";
        std::cout << "Replay hash: " << first.kernel.events().stableHash() << '\n';
        std::cout << "Events: " << first.kernel.events().size() << '\n';
        std::cout << "Detection time: T+" << first.kernel.world().metrics.detection_time << '\n';

        const auto claims = InterventionEngine::buildClaims(first.kernel.events(), first.kernel.world());
        CredibilityEngine credibility(std::filesystem::path(DARLA_SOURCE_DIR) / "models");
        const auto assessments = credibility.assessClaims(
            claims,
            first.kernel.events(),
            first.degradation_snapshot,
            first.kernel.world().metrics,
            first.scenario.config.max_ticks);

        PlantedTruthScorer scorer;
        const auto planted_score = scorer.score(first.scenario.planted_causal_truth, claims);
        std::cout << "\nPlanted causal truth recovery: " << std::fixed << std::setprecision(2) << planted_score.recovery_score << '\n';
        std::cout << "  precision/recall/F1: " << planted_score.precision << '/' << planted_score.recall
                  << '/' << planted_score.f1 << ", SHD: " << planted_score.structural_hamming_distance << '\n';
        for (const auto& edge : planted_score.matched_edges) {
            std::cout << "  matched: " << edge << '\n';
        }
        for (const auto& edge : planted_score.missing_edges) {
            std::cout << "  missing: " << edge << '\n';
        }

        std::cout << "\nCredibility assessments:\n";
        for (const auto& assessment : assessments) {
            std::cout << "  " << assessment.claim.label << '\n';
            std::cout << "    status: " << toString(assessment.claim.status)
                      << ", score " << std::fixed << std::setprecision(2) << assessment.credibility_score
                      << ", reportable " << (assessment.reportable ? "yes" : "no") << '\n';
            std::cout << "    model: " << assessment.contract.model_name
                      << ", risk " << std::fixed << std::setprecision(2) << assessment.risk.score()
                      << ", rigor: " << assessment.risk.required_rigor << '\n';
            std::cout << "    falsification: " << (assessment.falsification.overturned ? "overturned" : "survived")
                      << " - " << assessment.falsification.summary << '\n';
            for (const auto& branch : assessment.falsification.branch_outcomes) {
                std::cout << "      branch: " << branch << '\n';
            }
        }
        return 0;
    } catch (const std::exception& ex) {
        std::cerr << "sim-verify error: " << ex.what() << '\n';
        return 1;
    }
}
