#include "sim-causal/MinimumInterventionSearch.h"
#include "sim-tools/ScenarioRunner.h"

#include <filesystem>
#include <iomanip>
#include <iostream>
#include <optional>
#include <stdexcept>

using namespace darla;

namespace {

void printSet(const std::string& label, const InterventionSetResult& result) {
    std::cout << label << ": " << describeInterventionSet(result.options) << '\n';
    std::cout << "  detection_time: T+" << result.result.counterfactual.detection_time << '\n';
    std::cout << "  mission_score: " << std::fixed << std::setprecision(2) << result.result.counterfactual.mission_success_score << '\n';
    std::cout << "  estimated_effect: " << std::showpos << std::fixed << std::setprecision(2)
              << result.result.estimated_effect << std::noshowpos << '\n';
    std::cout << "  cost: " << std::fixed << std::setprecision(2) << result.total_cost
              << ", risk: " << result.total_risk
              << ", search_score: " << result.score << '\n';
}

} // namespace

int main(int argc, char** argv) {
    try {
        if (argc < 2) {
            std::cerr << "usage: sim-search <scenario.yaml> [--seed N]\n";
            return 2;
        }

        std::optional<std::uint64_t> seed_override;
        for (int i = 2; i + 1 < argc; ++i) {
            if (std::string(argv[i]) == "--seed") {
                seed_override = std::stoull(argv[i + 1]);
            }
        }

        const auto run = runScenarioFile(std::filesystem::path(argv[1]), seed_override);
        if (!run.has_degradation_snapshot) {
            throw std::runtime_error("scenario did not produce a cyber degradation snapshot");
        }

        MinimumInterventionSearch search;
        const auto result = search.run(run.degradation_snapshot, run.kernel.world().metrics, run.scenario.config.max_ticks);

        std::cout << "MINIMUM INTERVENTION SEARCH\n";
        std::cout << "Baseline detection: T+" << run.kernel.world().metrics.detection_time
                  << ", score " << std::fixed << std::setprecision(2) << run.kernel.world().metrics.mission_success_score << '\n';
        printSet("\nLowest-cost effective intervention", result.lowest_cost_effective);
        printSet("\nBest mission-effect intervention", result.best_effective);

        std::cout << "\nRejected / insufficient interventions:\n";
        for (const auto& rejected : result.rejected) {
            if (rejected.options.size() == 1) {
                std::cout << "  " << describeInterventionSet(rejected.options)
                          << " effect=" << std::showpos << std::fixed << std::setprecision(2)
                          << rejected.result.estimated_effect << std::noshowpos << '\n';
            }
        }
        return 0;
    } catch (const std::exception& ex) {
        std::cerr << "sim-search error: " << ex.what() << '\n';
        return 1;
    }
}
