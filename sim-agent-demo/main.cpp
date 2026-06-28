#include "sim-causal/InterventionEngine.h"
#include "sim-credibility/CredibilityEngine.h"
#include "sim-tools/ScenarioRunner.h"

#include <filesystem>
#include <iomanip>
#include <iostream>
#include <optional>
#include <stdexcept>

using namespace darla;

namespace {

const SimEvent* findOnlineDecision(const EventLedger& ledger) {
    for (const auto& event : ledger.events()) {
        if (event.label == "online_agent_decision") return &event;
    }
    return nullptr;
}

} // namespace

int main(int argc, char** argv) {
    try {
        if (argc < 2) {
            std::cerr << "usage: sim-agent-demo <scenario.yaml> [--seed N]\n";
            return 2;
        }

        std::optional<std::uint64_t> seed_override;
        for (int i = 2; i + 1 < argc; ++i) {
            if (std::string(argv[i]) == "--seed") {
                seed_override = std::stoull(argv[i + 1]);
            }
        }

        const auto baseline = runScenarioFile(std::filesystem::path(argv[1]), seed_override, false);
        const auto online = runScenarioFile(std::filesystem::path(argv[1]), seed_override, true);
        const auto* decision = findOnlineDecision(online.kernel.events());

        std::cout << "REAL-TIME HETEROGENEOUS AGENT DEMO\n";
        std::cout << "Baseline detection: T+" << baseline.kernel.world().metrics.detection_time
                  << ", score " << std::fixed << std::setprecision(2) << baseline.kernel.world().metrics.mission_success_score << '\n';
        std::cout << "Online-agent detection: T+" << online.kernel.world().metrics.detection_time
                  << ", score " << std::fixed << std::setprecision(2) << online.kernel.world().metrics.mission_success_score << '\n';

        if (decision) {
            std::cout << "\nOnline decision at T+" << decision->tick << '\n';
            std::cout << "  Agent: BlueCommanderAgent\n";
            std::cout << "  Evidence parent count: " << decision->causal_parent_events.size() << '\n';
            for (const auto& delta : decision->deltas) {
                std::cout << "  " << delta.field << ": " << delta.before << " -> " << delta.after << '\n';
            }
            std::cout << "  Rationale: " << decision->provenance << '\n';
        }

        std::cout << "\nHeterogeneous agent evidence:\n";
        for (const auto& event : online.kernel.events().events()) {
            if (event.label == "red_cyber_agent_decision" ||
                event.label == "sensor_agent_observation" ||
                event.label == "comms_agent_observation" ||
                event.label == "blue_uas_agent_observation" ||
                event.label == "logistics_agent_observation") {
                std::cout << "  " << event.label << " at T+" << event.tick << '\n';
            }
        }

        const auto claims = InterventionEngine::buildClaims(baseline.kernel.events(), baseline.kernel.world());
        CredibilityEngine credibility(std::filesystem::path(DARLA_SOURCE_DIR) / "models");
        const auto assessments = credibility.assessClaims(
            claims,
            baseline.kernel.events(),
            baseline.degradation_snapshot,
            baseline.kernel.world().metrics,
            baseline.scenario.config.max_ticks);

        std::cout << "\nAsynchronous validation summary:\n";
        if (online.has_async_summary) {
            std::cout << "  slow loop completed for action: " << online.async_summary.agent_action << '\n';
            std::cout << "  falsification: " << (online.async_summary.falsification_survived ? "survived" : "overturned")
                      << " - " << online.async_summary.falsification_summary << '\n';
            std::cout << "  lowest-cost intervention: " << online.async_summary.lowest_cost_intervention << '\n';
            std::cout << "  best-effect intervention: " << online.async_summary.best_effect_intervention << '\n';
            std::cout << "  planted truth recovery: " << std::fixed << std::setprecision(2)
                      << online.async_summary.planted_truth_recovery << '\n';
            for (const auto& edge : online.async_summary.matched_planted_edges) {
                std::cout << "    matched planted edge: " << edge << '\n';
            }
        }
        for (const auto& assessment : assessments) {
            if (assessment.claim.label == "sensor_confidence_loss -> delayed_detection" ||
                assessment.claim.label == "logistics_delay -> mission_failure rejected") {
                std::cout << "  " << assessment.claim.label << ": "
                          << (assessment.falsification.overturned ? "overturned" : "survived")
                          << " - " << assessment.falsification.summary << '\n';
            }
        }
        return 0;
    } catch (const std::exception& ex) {
        std::cerr << "sim-agent-demo error: " << ex.what() << '\n';
        return 1;
    }
}
