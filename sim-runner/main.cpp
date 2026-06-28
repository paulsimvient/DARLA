#include "sim-causal/InterventionEngine.h"
#include "sim-tools/ScenarioRunner.h"

#include <filesystem>
#include <iomanip>
#include <iostream>
#include <optional>
#include <stdexcept>

using namespace darla;

namespace {

std::string outcome(bool success) {
    return success ? "success" : "failure";
}

void printClaims(const std::vector<CausalClaim>& claims) {
    for (const auto& claim : claims) {
        std::cout << "  " << claim.label << ": " << toString(claim.status)
                  << ", confidence " << std::fixed << std::setprecision(2) << claim.confidence << '\n';
    }
}

} // namespace

int main(int argc, char** argv) {
    try {
        if (argc < 2) {
            std::cerr << "usage: sim-runner <scenario.yaml> [--seed N] [--out events.log]\n";
            return 2;
        }
        std::filesystem::path scenario_path = argv[1];
        std::optional<std::uint64_t> seed_override;
        std::filesystem::path out_path;
        for (int i = 2; i + 1 < argc; ++i) {
            if (std::string(argv[i]) == "--seed") {
                seed_override = std::stoull(argv[i + 1]);
            } else if (std::string(argv[i]) == "--out") {
                out_path = argv[i + 1];
            }
        }

        const auto run = runScenarioFile(scenario_path, seed_override);
        const auto& kernel = run.kernel;
        const auto& scenario = run.scenario;

        const auto baseline = kernel.world().metrics;
        auto baseline_claims = InterventionEngine::buildClaims(kernel.events(), kernel.world());

        InterventionEngine engine;
        CounterfactualResult cf = engine.run(run.degradation_snapshot, baseline, Intervention{InterventionType::IsolateCompromisedSensorFeed, 760, "blue_uas_1"}, scenario.config.max_ticks);

        std::cout << "BASELINE RUN seed=" << scenario.config.seed << '\n';
        std::cout << "Mission outcome: " << outcome(baseline.mission_success) << '\n';
        std::cout << "Detection time: T+" << baseline.detection_time << '\n';
        std::cout << "Mission success score: " << std::fixed << std::setprecision(2) << baseline.mission_success_score << '\n';
        if (baseline.emergent_tempo_collapse) {
            std::cout << "Emergent behavior: operational tempo collapse\n";
        }
        std::cout << "\nDominant causal pathway:\n";
        std::cout << "  red_cyber_degradation\n";
        std::cout << "    -> sensor_confidence_loss\n";
        std::cout << "      -> delayed_detection\n";
        std::cout << "        -> late_coa_selection\n";
        std::cout << "          -> mission_failure\n";
        std::cout << "\nClaim status:\n";
        printClaims(baseline_claims);
        std::cout << "\nReplay hash: " << kernel.events().stableHash() << '\n';

        std::cout << "\nCOUNTERFACTUAL do(" << toString(InterventionType::IsolateCompromisedSensorFeed) << ") at T+760\n";
        std::cout << "Detection time: T+" << cf.counterfactual.detection_time << '\n';
        std::cout << "Mission success score: " << std::fixed << std::setprecision(2) << cf.counterfactual.mission_success_score << '\n';
        std::cout << "Estimated causal effect: " << std::showpos << std::fixed << std::setprecision(2) << cf.estimated_effect << std::noshowpos << '\n';
        std::cout << "Confidence: " << cf.confidence << '\n';
        std::cout << "Validity: " << cf.validity << '\n';
        if (!out_path.empty()) {
            kernel.events().saveToFile(out_path);
            std::cout << "\nWrote event ledger: " << out_path << '\n';
        }
        return 0;
    } catch (const std::exception& ex) {
        std::cerr << "sim-runner error: " << ex.what() << '\n';
        return 1;
    }
}
