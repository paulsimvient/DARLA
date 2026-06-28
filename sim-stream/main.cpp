#include "sim-tools/ScenarioRunner.h"
#include "sim-tools/SimFrameExporter.h"

#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace darla;

namespace {

bool shouldCaptureFrame(Tick tick, Tick max_ticks, bool has_events) {
    if (tick == 0) return true;
    if (has_events) return true;
    if (tick + 1 >= max_ticks) return true;
    if (tick % 60 == 0) return true;
    return false;
}

} // namespace

int main(int argc, char** argv) {
    try {
        if (argc < 2) {
            std::cerr << "usage: sim-stream <scenario.yaml> [--seed N] [--mode policy_auto|explicit|human_hold] [--approve action@tick] [--out file.json]\n";
            return 2;
        }

        ScenarioRunOptions options = parseScenarioRunOptions(argc, argv, 2);
        std::filesystem::path out_path;
        for (int i = 2; i < argc; ++i) {
            if (std::string(argv[i]) == "--out" && i + 1 < argc) {
                out_path = argv[i + 1];
            }
        }

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
        frame_options.replay_hash = kernel.events().stableHash();

        const Tick max_ticks = scenario.config.max_ticks;
        std::vector<std::string> frames;
        Tick last_frame_tick = 0;
        frames.push_back(buildSimFrameJson(0, kernel.world(), {}, &kernel.causalGraph(), frame_options));

        std::size_t previous_event_count = 0;
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

            if (shouldCaptureFrame(frame_tick, max_ticks, !tick_events.empty())) {
                frame_options.replay_hash = kernel.events().stableHash();
                frames.push_back(buildSimFrameJson(frame_tick, kernel.world(), tick_events, &kernel.causalGraph(), frame_options));
                last_frame_tick = frame_tick;
            }
        }

        std::ostringstream out;
        out << '{'
            << "\"scenario_id\":\"" << scenario.config.scenario_id << "\","
            << "\"seed\":" << scenario.config.seed << ','
            << "\"authorization_mode\":\"" << toString(options.authorization_mode) << "\","
            << "\"max_ticks\":" << max_ticks << ','
            << "\"tick_seconds\":" << scenario.config.tick_seconds << ','
            << "\"mission_cutoff\":" << scenario.mission.target_detected_before_tick << ','
            << "\"final_tick\":" << last_frame_tick << ','
            << "\"replay_hash\":\"" << kernel.events().stableHash() << "\","
            << "\"frames\":[";
        for (std::size_t i = 0; i < frames.size(); ++i) {
            if (i > 0) out << ',';
            out << frames[i];
        }
        out << "]}";

        const std::string payload = out.str();
        if (!out_path.empty()) {
            std::ofstream file{out_path};
            if (!file) throw std::runtime_error("unable to write: " + out_path.string());
            file << payload;
        } else {
            std::cout << payload;
        }
        return 0;
    } catch (const std::exception& ex) {
        std::cerr << "sim-stream error: " << ex.what() << '\n';
        return 1;
    }
}
