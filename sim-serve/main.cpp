#include "sim-tools/ScenarioRunner.h"
#include "sim-tools/SimCommandProcessor.h"
#include "sim-tools/SimFrameExporter.h"

#ifdef DARLA_ENABLE_PYTHON_SCRIPTING
#include "sim-scripting/PythonRuntime.h"
#endif

#include "sim-events/SimEvent.h"

#include <fcntl.h>
#include <chrono>
#include <iostream>
#include <memory>
#include <sstream>
#include <string>
#include <thread>
#include <unistd.h>
#include <vector>

using namespace darla;

namespace {

void emitSse(const std::string& event, const std::string& data) {
    std::cout << "event: " << event << "\n";
    std::cout << "data: " << data << "\n\n";
    std::cout.flush();
}

bool releasesReviewHold(const std::string& command_type) {
    return command_type == "approve_coa" || command_type == "reject_coa" ||
           command_type == "continue_review";
}

bool processStdinLine(SimulationKernel& kernel, const std::string& line, std::string& command_type) {
    if (line.empty()) return false;
    const auto result = processCommandJson(kernel.world(), kernel.events(), line);
    command_type = result.command_type;
    std::ostringstream ack;
    ack << "{\"ok\":" << (result.ok ? "true" : "false")
        << ",\"type\":\"" << result.command_type << '"'
        << ",\"message\":\"" << result.message << '"'
        << ",\"event_id\":" << result.event_id
        << ",\"tick\":" << kernel.world().tick << '}';
    emitSse("command", ack.str());
    return releasesReviewHold(result.command_type);
}

void drainStdinCommands(SimulationKernel& kernel) {
    char buffer[4096];
    while (true) {
        const ssize_t bytes = read(STDIN_FILENO, buffer, sizeof(buffer) - 1);
        if (bytes <= 0) break;
        buffer[bytes] = '\0';

        std::istringstream stream(buffer);
        std::string line;
        while (std::getline(stream, line)) {
            std::string command_type;
            processStdinLine(kernel, line, command_type);
        }
    }
}

std::string buildReviewHeartbeatJson(Tick frame_tick, const WorldState& world);

void waitForReviewRelease(SimulationKernel& kernel, Tick frame_tick) {
    const int flags = fcntl(STDIN_FILENO, F_GETFL, 0);
    fcntl(STDIN_FILENO, F_SETFL, flags | O_NONBLOCK);

    while (true) {
        char buffer[4096];
        const ssize_t bytes = read(STDIN_FILENO, buffer, sizeof(buffer) - 1);
        if (bytes > 0) {
            buffer[bytes] = '\0';

            std::istringstream stream(buffer);
            std::string line;
            while (std::getline(stream, line)) {
                std::string command_type;
                if (processStdinLine(kernel, line, command_type) && releasesReviewHold(command_type)) {
                    fcntl(STDIN_FILENO, F_SETFL, flags | O_NONBLOCK);
                    return;
                }
            }
        }

        emitSse("heartbeat", buildReviewHeartbeatJson(frame_tick, kernel.world()));
        std::this_thread::sleep_for(std::chrono::milliseconds(250));
    }
}

bool hasCoaReviewEvent(const std::vector<const SimEvent*>& tick_events) {
    for (const SimEvent* event : tick_events) {
        if (event != nullptr && event->label == "coa_recommendation") {
            return true;
        }
    }
    return false;
}

std::string buildReviewHoldJson(Tick frame_tick, const WorldState& world) {
    std::ostringstream out;
    out << "{\"tick\":" << frame_tick << ",\"coa_ids\":[";
    bool first = true;
    for (const auto& coa : world.coa_log) {
        if (coa.proposed_tick != frame_tick) continue;
        if (!first) out << ',';
        first = false;
        out << coa.id;
    }
    out << "]}";
    return out.str();
}

std::string buildReviewHeartbeatJson(Tick frame_tick, const WorldState& world) {
    std::ostringstream out;
    out << "{\"tick\":" << frame_tick
        << ",\"state\":\"review_hold\""
        << ",\"message\":\"Waiting for human COA review\""
        << ",\"coa_ids\":[";
    bool first = true;
    for (const auto& coa : world.coa_log) {
        if (coa.proposed_tick != frame_tick) continue;
        if (!first) out << ',';
        first = false;
        out << coa.id;
    }
    out << "]}";
    return out.str();
}

bool shouldPauseForReview(
    const Scenario& scenario,
    AuthorizationMode mode,
    const std::vector<const SimEvent*>& tick_events) {
    if (!scenario.timeline.pause_at_coa_reviews) return false;
    if (mode != AuthorizationMode::HumanHold) return false;
    return hasCoaReviewEvent(tick_events);
}

std::string readFlagValue(int argc, char** argv, const std::string& flag) {
    for (int i = 2; i + 1 < argc; ++i) {
        if (std::string(argv[i]) == flag) {
            return argv[i + 1];
        }
    }
    return {};
}

} // namespace

int main(int argc, char** argv) {
    try {
        if (argc < 2) {
            std::cerr << "usage: sim-serve <scenario.yaml> [--seed N] [--mode policy_auto|explicit|human_hold] [--run-id ID] [--branch-id ID] [--parent-run-id ID]\n";
            return 2;
        }

        const int flags = fcntl(STDIN_FILENO, F_GETFL, 0);
        fcntl(STDIN_FILENO, F_SETFL, flags | O_NONBLOCK);

        ScenarioRunOptions options = parseScenarioRunOptions(argc, argv, 2);

        ScenarioLoader loader;
        Scenario scenario = loader.load(std::filesystem::path(argv[1]));
        if (options.seed_override) {
            scenario.config.seed = *options.seed_override;
        }

        SimulationKernel kernel;
        RelationshipGraph graph;
        CausalActionEstimator estimator;
#ifdef DARLA_ENABLE_PYTHON_SCRIPTING
        std::unique_ptr<ScriptRuntime> script_runtime = createPythonRuntime();
        kernel.setScriptRuntime(script_runtime.get());
#endif
        kernel.loadScenario(scenario);
        configureAgentRuntime(
            kernel.world(),
            scenario,
            graph,
            estimator,
            true,
            options.authorization_mode,
            options.approved_coas);

        FrameBuildOptions frame_options;
        frame_options.include_budgets = true;
        frame_options.run_id = readFlagValue(argc, argv, "--run-id");
        frame_options.branch_id = readFlagValue(argc, argv, "--branch-id");
        if (frame_options.branch_id.empty()) frame_options.branch_id = "baseline";
        frame_options.parent_run_id = readFlagValue(argc, argv, "--parent-run-id");
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

        emitSse(
            "tick",
            buildSimFrameJson(0, kernel.world(), {}, &kernel.causalGraph(), frame_options));

        std::size_t previous_event_count = 0;
        Tick last_frame_tick = 0;
        while (kernel.world().tick < max_ticks) {
            drainStdinCommands(kernel);
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

            if (shouldPauseForReview(scenario, options.authorization_mode, tick_events)) {
                emitSse("review_hold", buildReviewHoldJson(frame_tick, kernel.world()));
                waitForReviewRelease(kernel, frame_tick);
            }

            if (scenario.timeline.tick_pacing_ms > 0) {
                std::this_thread::sleep_for(std::chrono::milliseconds(scenario.timeline.tick_pacing_ms));
            }
        }

        std::ostringstream done;
        done << "{\"final_tick\":" << last_frame_tick
             << ",\"replay_hash\":" << std::to_string(kernel.events().stableHash())
             << ",\"run_id\":\"" << frame_options.run_id << "\"}";
        emitSse("done", done.str());
        return 0;
    } catch (const std::exception& ex) {
        std::cerr << "sim-serve error: " << ex.what() << '\n';
        return 1;
    }
}
