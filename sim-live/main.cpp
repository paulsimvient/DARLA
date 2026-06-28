#include "sim-tools/ScenarioRunner.h"
#include "sim-tools/SimFrameExporter.h"

#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace darla;

namespace {

void emitSse(const std::string& event, const std::string& data) {
    std::cout << "event: " << event << "\n";
    std::cout << "data: " << data << "\n\n";
    std::cout.flush();
}

void writeMetrics(std::ostringstream& out, const MissionMetrics& metrics) {
    out << "{"
        << "\"target_detected\":" << (metrics.target_detected ? "true" : "false") << ','
        << "\"detection_time\":" << metrics.detection_time << ','
        << "\"coa_selection_time\":" << metrics.coa_selection_time << ','
        << "\"mission_success\":" << (metrics.mission_success ? "true" : "false") << ','
        << "\"mission_success_score\":" << metrics.mission_success_score << ','
        << "\"emergent_tempo_collapse\":" << (metrics.emergent_tempo_collapse ? "true" : "false")
        << '}';
}

} // namespace

int main(int argc, char** argv) {
    try {
        if (argc < 2) {
            std::cerr << "usage: sim-live <scenario.yaml> [--seed N] [--mode policy_auto|explicit|human_hold] [--approve action@tick]\n";
            return 2;
        }

        ScenarioRunOptions options = parseScenarioRunOptions(argc, argv, 2);
        ScenarioLoader loader;
        Scenario scenario = loader.load(std::filesystem::path(argv[1]));
        if (options.seed_override) {
            scenario.config.seed = *options.seed_override;
        }

        SimulationKernel kernel;
        RelationshipGraph graph;
        CausalActionEstimator estimator;
        kernel.loadScenario(scenario);
        configureAgentRuntime(
            kernel.world(),
            scenario,
            graph,
            estimator,
            options.enable_realtime_agents,
            options.authorization_mode,
            options.approved_coas);

        FrameBuildOptions frame_options;
        frame_options.include_budgets = true;
        frame_options.replay_hash = kernel.events().stableHash();

        const Tick max_ticks = scenario.config.max_ticks;
        emitSse(
            "meta",
            buildRunMetaJson(
                scenario.config.scenario_id,
                scenario.config.seed,
                options.authorization_mode,
                max_ticks,
                scenario.config.tick_seconds,
                scenario.mission.target_detected_before_tick,
                frame_options));

        emitSse("tick", buildSimFrameJson(0, kernel.world(), {}, &kernel.causalGraph(), frame_options));

        std::size_t previous_event_count = 0;
        Tick last_frame_tick = 0;
        while (kernel.world().tick < max_ticks) {
            kernel.step();
            const Tick frame_tick = kernel.world().tick > 0 ? kernel.world().tick - 1 : 0;

            std::vector<const SimEvent*> tick_events;
            const auto& events = kernel.events().events();
            for (std::size_t i = previous_event_count; i < events.size(); ++i) {
                if (events[i].tick == frame_tick) {
                    tick_events.push_back(&events[i]);
                }
            }
            previous_event_count = events.size();

            frame_options.replay_hash = kernel.events().stableHash();
            emitSse(
                "tick",
                buildSimFrameJson(frame_tick, kernel.world(), tick_events, &kernel.causalGraph(), frame_options));
            last_frame_tick = frame_tick;
        }

        std::ostringstream done;
        done << "{\"final_tick\":" << last_frame_tick << ",\"metrics\":";
        writeMetrics(done, kernel.world().metrics);
        done << ",\"replay_hash\":" << kernel.events().stableHash() << '}';
        emitSse("done", done.str());
        return 0;
    } catch (const std::exception& ex) {
        std::cerr << "sim-live error: " << ex.what() << '\n';
        return 1;
    }
}
