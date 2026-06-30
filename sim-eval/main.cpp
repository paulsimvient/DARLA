#include "sim-causal/RuntimeHypothesisGraph.h"
#include "sim-tools/ScenarioRunner.h"

#include <algorithm>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>

using namespace darla;

namespace {

struct Args {
    std::filesystem::path scenario;
    std::uint64_t seed = 42;
    std::size_t top_edges = 8;
    bool json = false;
    std::optional<std::filesystem::path> out;
};

Args parseArgs(int argc, char** argv) {
    if (argc < 2) throw std::invalid_argument("usage: sim-eval <scenario.yaml> [--seed N] [--top N] [--json] [--out report.json]");
    Args args;
    args.scenario = argv[1];
    for (int i = 2; i < argc; ++i) {
        const std::string arg = argv[i];
        if (arg == "--seed" && i + 1 < argc) args.seed = std::stoull(argv[++i]);
        else if (arg == "--top" && i + 1 < argc) args.top_edges = std::stoull(argv[++i]);
        else if (arg == "--json") args.json = true;
        else if (arg == "--out" && i + 1 < argc) args.out = std::filesystem::path(argv[++i]);
    }
    return args;
}

std::string escapeJson(const std::string& input) {
    std::ostringstream out;
    for (const char ch : input) {
        switch (ch) {
        case '\\': out << "\\\\"; break;
        case '"': out << "\\\""; break;
        case '\n': out << "\\n"; break;
        case '\r': out << "\\r"; break;
        case '\t': out << "\\t"; break;
        default: out << ch; break;
        }
    }
    return out.str();
}

std::string statusFor(double value, double passAt, double watchAt) {
    if (value >= passAt) return "pass";
    if (value >= watchAt) return "watch";
    return "fail";
}

} // namespace

int main(int argc, char** argv) {
    try {
        const auto args = parseArgs(argc, argv);
        ScenarioRunOptions options;
        options.seed_override = args.seed;
        options.enable_realtime_agents = false;
        options.authorization_mode = AuthorizationMode::PolicyAuto;

        const auto run = runScenarioFile(args.scenario, options);
        const auto graph = buildRuntimeHypothesisGraph(run.kernel.events().events());
        const double mission = run.kernel.world().metrics.mission_success_score;
        const double precision_proxy = graph.edges.empty() ? 0.0 : std::min(1.0, graph.edges.front().total_score);
        const double recall_proxy = std::min(1.0, static_cast<double>(graph.edges.size()) / 3.0);
        const double readiness = 0.45 * precision_proxy + 0.35 * recall_proxy + 0.20 * mission;

        std::ostringstream json;
        json << std::fixed << std::setprecision(4);
        json << "{\n";
        json << "  \"manifest_version\": \"darla-sim-eval-v1\",\n";
        json << "  \"scenario\": \"" << escapeJson(run.scenario.config.scenario_id) << "\",\n";
        json << "  \"scenario_file\": \"" << escapeJson(args.scenario.string()) << "\",\n";
        json << "  \"seed\": " << run.scenario.config.seed << ",\n";
        json << "  \"truth_access\": \"hidden_from_runtime\",\n";
        json << "  \"events\": " << run.kernel.events().size() << ",\n";
        json << "  \"runtime_hypothesis_edges\": " << graph.edges.size() << ",\n";
        json << "  \"mission_success_score\": " << mission << ",\n";
        json << "  \"target_detected\": " << (run.kernel.world().metrics.target_detected ? "true" : "false") << ",\n";
        json << "  \"detection_time\": " << run.kernel.world().metrics.detection_time << ",\n";
        json << "  \"metrics\": {\n";
        json << "    \"causal_precision_proxy\": " << precision_proxy << ",\n";
        json << "    \"causal_recall_proxy\": " << recall_proxy << ",\n";
        json << "    \"readiness_score\": " << readiness << ",\n";
        json << "    \"status\": \"" << statusFor(readiness, 0.75, 0.50) << "\"\n";
        json << "  },\n";
        json << "  \"top_runtime_causal_hypotheses\": [\n";
        for (std::size_t i = 0; i < graph.edges.size() && i < args.top_edges; ++i) {
            const auto& edge = graph.edges[i];
            json << "    {\"rank\": " << (i + 1)
                 << ", \"cause\": \"" << escapeJson(edge.cause)
                 << "\", \"effect\": \"" << escapeJson(edge.effect)
                 << "\", \"score\": " << edge.total_score
                 << ", \"temporal\": " << edge.temporal_precedence
                 << ", \"intervention\": " << edge.intervention_contrast
                 << ", \"confounding_penalty\": " << edge.confounding_penalty << "}";
            if (i + 1 < graph.edges.size() && i + 1 < args.top_edges) json << ",";
            json << "\n";
        }
        json << "  ]\n";
        json << "}\n";

        if (args.out) {
            std::ofstream file(*args.out);
            file << json.str();
        }

        if (args.json) {
            std::cout << json.str();
        } else {
            std::cout << "DARLA RUNTIME EVAL\n";
            std::cout << "scenario: " << run.scenario.config.scenario_id << "\n";
            std::cout << "seed: " << run.scenario.config.seed << "\n";
            std::cout << "events: " << run.kernel.events().size() << "\n";
            std::cout << "runtime_hypothesis_edges: " << graph.edges.size() << "\n";
            std::cout << "mission_success_score: " << std::fixed << std::setprecision(2) << mission << "\n";
            std::cout << "target_detected: " << (run.kernel.world().metrics.target_detected ? "true" : "false") << "\n";
            std::cout << "detection_time: T+" << run.kernel.world().metrics.detection_time << "\n";
            std::cout << "truth_access: hidden_from_runtime\n";
            std::cout << "readiness_score: " << readiness << "\n";
        }
        return 0;
    } catch (const std::exception& ex) {
        std::cerr << "sim-eval error: " << ex.what() << '\n';
        return 1;
    }
}
