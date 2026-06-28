#include "sim-causal/InterventionEngine.h"
#include "sim-tools/ScenarioRunner.h"

#include <filesystem>
#include <iomanip>
#include <iostream>
#include <optional>
#include <stdexcept>

using namespace darla;

namespace {

InterventionType parseIntervention(const std::string& value) {
    if (value == "isolate_compromised_sensor_feed") return InterventionType::IsolateCompromisedSensorFeed;
    if (value == "restore_comms_relay") return InterventionType::RestoreCommsRelay;
    if (value == "remove_logistics_delay") return InterventionType::RemoveLogisticsDelay;
    if (value == "enable_autonomous_search") return InterventionType::EnableAutonomousSearch;
    if (value == "pre_authorize_engagement") return InterventionType::PreAuthorizeEngagement;
    throw std::runtime_error("unknown intervention: " + value);
}

std::string defaultTarget(InterventionType type) {
    switch (type) {
    case InterventionType::IsolateCompromisedSensorFeed:
    case InterventionType::EnableAutonomousSearch:
        return "blue_uas_1";
    case InterventionType::RestoreCommsRelay:
        return "blue_relay_1";
    case InterventionType::RemoveLogisticsDelay:
        return "logistics_support_node";
    case InterventionType::PreAuthorizeEngagement:
        return "blue_commander";
    }
    return "blue_uas_1";
}

} // namespace

int main(int argc, char** argv) {
    try {
        if (argc < 2) {
            std::cerr << "usage: sim-counterfactual <scenario.yaml> [--seed N] [--at TICK] [--intervention NAME]\n";
            return 2;
        }

        std::optional<std::uint64_t> seed_override;
        Tick intervention_tick = 760;
        InterventionType intervention_type = InterventionType::IsolateCompromisedSensorFeed;
        for (int i = 2; i + 1 < argc; ++i) {
            if (std::string(argv[i]) == "--seed") {
                seed_override = std::stoull(argv[i + 1]);
            } else if (std::string(argv[i]) == "--at") {
                intervention_tick = std::stoull(argv[i + 1]);
            } else if (std::string(argv[i]) == "--intervention") {
                intervention_type = parseIntervention(argv[i + 1]);
            }
        }

        const auto run = runScenarioFile(std::filesystem::path(argv[1]), seed_override);
        if (!run.has_degradation_snapshot) {
            throw std::runtime_error("scenario did not produce a cyber degradation snapshot");
        }

        InterventionEngine engine;
        const auto result = engine.run(
            run.degradation_snapshot,
            run.kernel.world().metrics,
            Intervention{intervention_type, intervention_tick, defaultTarget(intervention_type)},
            run.scenario.config.max_ticks);

        std::cout << "Counterfactual: do(" << toString(intervention_type)
                  << ") at T+" << intervention_tick << '\n';
        std::cout << "Baseline detection: T+" << result.baseline.detection_time
                  << ", score " << std::fixed << std::setprecision(2) << result.baseline.mission_success_score << '\n';
        std::cout << "Counterfactual detection: T+" << result.counterfactual.detection_time
                  << ", score " << std::fixed << std::setprecision(2) << result.counterfactual.mission_success_score << '\n';
        std::cout << "Estimated effect: " << std::showpos << std::fixed << std::setprecision(2)
                  << result.estimated_effect << std::noshowpos << '\n';
        std::cout << "Confidence: " << result.confidence << '\n';
        std::cout << "Validity: " << result.validity << '\n';
        return 0;
    } catch (const std::exception& ex) {
        std::cerr << "sim-counterfactual error: " << ex.what() << '\n';
        return 1;
    }
}
