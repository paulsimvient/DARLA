#include "FmuConfig.h"
#include "sim-adjudication/EmergenceDetector.h"
#include "sim-causal/CalibrationHarness.h"
#include "sim-causal/CausalClaimBuilder.h"
#include "sim-causal/InterventionEngine.h"
#include "sim-causal/MinimumInterventionSearch.h"
#include "sim-causal/PlantedTruthScorer.h"
#include "sim-credibility/CredibilityEngine.h"
#include "Entity.h"
#include "sim-graph/RelationshipGraph.h"
#include "sim-graph/TemporalCausalGraph.h"
#include "sim-tools/ScenarioRunner.h"
#include "sim-tools/SimFrameExporter.h"

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

std::string jsonEscape(const std::string& value) {
    std::ostringstream out;
    for (char c : value) {
        switch (c) {
        case '"': out << "\\\""; break;
        case '\\': out << "\\\\"; break;
        case '\n': out << "\\n"; break;
        case '\r': out << "\\r"; break;
        case '\t': out << "\\t"; break;
        default: out << c; break;
        }
    }
    return out.str();
}

std::string jsonString(const std::string& value) {
    return "\"" + jsonEscape(value) + "\"";
}

std::string jsonBool(bool value) {
    return value ? "true" : "false";
}

std::string jsonNumber(double value) {
    std::ostringstream out;
    out << std::fixed << std::setprecision(4) << value;
    return out.str();
}

std::string eventTypeName(EventType type) {
    return toString(type);
}

std::string claimStatusName(ClaimStatus status) {
    return toString(status);
}

std::string relationshipTypeName(RelationshipType type) {
    return toString(type);
}

void writeMetrics(std::ostringstream& out, const MissionMetrics& metrics) {
    out << "{"
        << "\"target_detected\":" << jsonBool(metrics.target_detected) << ','
        << "\"detection_time\":" << metrics.detection_time << ','
        << "\"coa_selection_time\":" << metrics.coa_selection_time << ','
        << "\"mission_success\":" << jsonBool(metrics.mission_success) << ','
        << "\"mission_success_score\":" << jsonNumber(metrics.mission_success_score) << ','
        << "\"emergent_tempo_collapse\":" << jsonBool(metrics.emergent_tempo_collapse)
        << '}';
}

std::string causalEdgeTypeName(CausalEdgeType type) {
    return toString(type);
}

void writeEvents(std::ostringstream& out, const EventLedger& ledger) {
    out << '[';
    bool first = true;
    for (const auto& event : ledger.events()) {
        if (!first) out << ',';
        first = false;
        out << '{'
            << "\"event_id\":" << event.event_id << ','
            << "\"tick\":" << event.tick << ','
            << "\"actor\":" << event.actor << ','
            << "\"type\":" << jsonString(eventTypeName(event.type)) << ','
            << "\"label\":" << jsonString(event.label) << ','
            << "\"confidence\":" << jsonNumber(event.confidence) << ','
            << "\"provenance\":" << jsonString(event.provenance) << ','
            << "\"causal_parent_count\":" << event.causal_parent_events.size() << ','
            << "\"causal_parent_events\":[";
        for (std::size_t i = 0; i < event.causal_parent_events.size(); ++i) {
            if (i > 0) out << ',';
            out << event.causal_parent_events[i];
        }
        out << "],\"deltas\":[";
        for (std::size_t i = 0; i < event.deltas.size(); ++i) {
            if (i > 0) out << ',';
            const auto& delta = event.deltas[i];
            out << '{'
                << "\"field\":" << jsonString(delta.field) << ','
                << "\"before\":" << jsonString(delta.before) << ','
                << "\"after\":" << jsonString(delta.after)
                << '}';
        }
        out << "]}";
    }
    out << ']';
}

void writeCausalGraph(std::ostringstream& out, const TemporalCausalGraph& graph) {
    out << '[';
    bool first = true;
    for (const auto& edge : graph.edges()) {
        if (!first) out << ',';
        first = false;
        out << '{'
            << "\"source_event_id\":" << edge.source << ','
            << "\"target_event_id\":" << edge.target << ','
            << "\"type\":" << jsonString(causalEdgeTypeName(edge.type)) << ','
            << "\"strength\":" << jsonNumber(edge.strength) << ','
            << "\"confidence\":" << jsonNumber(edge.confidence) << ','
            << "\"valid_from\":" << edge.valid_from << ','
            << "\"valid_to\":" << edge.valid_to << ','
            << "\"stale\":" << jsonBool(edge.stale) << ','
            << "\"label\":" << jsonString(edge.label)
            << '}';
    }
    out << ']';
}

void writeCausalDebug(
    std::ostringstream& out,
    const WorldState& world,
    const TemporalCausalGraph& graph,
    const EventLedger& ledger) {
    const auto& budgets = world.runtime_budgets;
    const auto& beliefs = world.agent_beliefs;
    const auto dominant = graph.dominantPathLabels();
    out << '{'
        << "\"event_count\":" << ledger.events().size() << ','
        << "\"causal_edge_count\":" << graph.edges().size() << ','
        << "\"dominant_path_labels\":[";
    for (std::size_t i = 0; i < dominant.size(); ++i) {
        if (i > 0) out << ',';
        out << jsonString(dominant[i]);
    }
    out << "],\"budget_limits\":{"
        << "\"agent_decisions_per_tick\":" << budgets.limits.agent_decisions_per_tick << ','
        << "\"causal_queries_per_tick\":" << budgets.limits.causal_queries_per_tick << ','
        << "\"async_replay_jobs\":" << budgets.limits.async_replay_jobs << ','
        << "\"async_branch_executions\":" << budgets.limits.async_branch_executions
        << "},\"budget_total_usage\":{"
        << "\"agent_decisions\":" << budgets.total_usage.agent_decisions << ','
        << "\"causal_queries\":" << budgets.total_usage.causal_queries << ','
        << "\"async_replay_jobs\":" << budgets.total_usage.async_replay_jobs << ','
        << "\"async_branch_executions\":" << budgets.total_usage.async_branch_executions
        << "},\"beliefs\":{"
        << "\"sensor_trust\":" << jsonNumber(beliefs.sensor.trust) << ','
        << "\"sensor_degraded\":" << jsonBool(beliefs.sensor.degraded) << ','
        << "\"comms_health\":" << jsonNumber(beliefs.comms.health) << ','
        << "\"mission_risk\":" << jsonNumber(beliefs.commander.mission_risk) << ','
        << "\"coa_entropy\":" << jsonNumber(beliefs.commander.coa_entropy) << ','
        << "\"causal_warning\":" << jsonBool(beliefs.causal_monitor.emergence_warning) << ','
        << "\"credibility_valid\":" << jsonBool(beliefs.credibility.validity_ok)
        << "}}";
}

void writeEntities(std::ostringstream& out, const WorldState& world) {
    out << '[';
    bool first = true;
    for (const auto& [id, entity] : world.entities) {
        if (!first) out << ',';
        first = false;
        out << '{'
            << "\"id\":" << jsonString(entity.name) << ','
            << "\"entity_id\":" << id << ','
            << "\"kind\":" << jsonString(toString(entity.kind)) << ','
            << "\"side\":" << jsonString(entity.side) << ','
            << "\"has_position\":" << jsonBool(entity.kinematic.has_value()) << ',';
        if (entity.kinematic) {
            out << "\"lat\":" << jsonNumber(entity.kinematic->lat) << ','
                << "\"lon\":" << jsonNumber(entity.kinematic->lon) << ','
                << "\"alt\":" << jsonNumber(entity.kinematic->alt) << ',';
        } else {
            out << "\"lat\":null,\"lon\":null,\"alt\":null,";
        }
        if (entity.sensor) {
            out << "\"sensor_range_km\":" << jsonNumber(entity.sensor->range_km) << ','
                << "\"sensor_confidence\":" << jsonNumber(entity.sensor->confidence) << ','
                << "\"sensor_degraded\":" << jsonBool(entity.sensor->degraded) << ','
                << "\"sensor_isolated\":" << jsonBool(entity.sensor->isolated);
        } else {
            out << "\"sensor_range_km\":null,\"sensor_confidence\":null,"
                << "\"sensor_degraded\":false,\"sensor_isolated\":false";
        }
        out << '}';
    }
    out << ']';
}

void writeRelationships(std::ostringstream& out, const RelationshipGraph& graph) {
    out << '[';
    bool first = true;
    for (const auto& edge : graph.edges()) {
        if (!first) out << ',';
        first = false;
        out << '{'
            << "\"type\":" << jsonString(relationshipTypeName(edge.type)) << ','
            << "\"source\":" << jsonString(edge.source) << ','
            << "\"target\":" << jsonString(edge.target) << ','
            << "\"component\":" << jsonString(edge.component)
            << '}';
    }
    out << ']';
}

void writeClaims(std::ostringstream& out, const std::vector<CausalClaim>& claims) {
    out << '[';
    bool first = true;
    for (const auto& claim : claims) {
        if (!first) out << ',';
        first = false;
        out << '{'
            << "\"label\":" << jsonString(claim.label) << ','
            << "\"cause_variable\":" << jsonString(claim.cause_variable) << ','
            << "\"effect_variable\":" << jsonString(claim.effect_variable) << ','
            << "\"status\":" << jsonString(claimStatusName(claim.status)) << ','
            << "\"confidence\":" << jsonNumber(claim.confidence) << ','
            << "\"effect_size\":" << jsonNumber(claim.effect_size)
            << '}';
    }
    out << ']';
}

void writeAssessments(std::ostringstream& out, const std::vector<CredibilityAssessment>& assessments) {
    out << '[';
    bool first = true;
    for (const auto& assessment : assessments) {
        if (!first) out << ',';
        first = false;
        out << '{'
            << "\"label\":" << jsonString(assessment.claim.label) << ','
            << "\"credibility_score\":" << jsonNumber(assessment.credibility_score) << ','
            << "\"reportable\":" << jsonBool(assessment.reportable) << ','
            << "\"model_name\":" << jsonString(assessment.contract.model_name) << ','
            << "\"risk_score\":" << jsonNumber(assessment.risk.score()) << ','
            << "\"required_rigor\":" << jsonString(assessment.risk.required_rigor) << ','
            << "\"falsification_survived\":" << jsonBool(assessment.falsification.survived) << ','
            << "\"falsification_summary\":" << jsonString(assessment.falsification.summary) << ','
            << "\"branch_outcomes\":[";
        for (std::size_t i = 0; i < assessment.falsification.branch_outcomes.size(); ++i) {
            if (i > 0) out << ',';
            out << jsonString(assessment.falsification.branch_outcomes[i]);
        }
        out << "]}";
    }
    out << ']';
}

void writeInterventionSearch(std::ostringstream& out, const MinimumInterventionSearchResult& search) {
    auto writeSet = [&](const InterventionSetResult& result) {
        out << '{'
            << "\"options\":" << jsonString(describeInterventionSet(result.options)) << ','
            << "\"detection_time\":" << result.result.counterfactual.detection_time << ','
            << "\"mission_score\":" << jsonNumber(result.result.counterfactual.mission_success_score) << ','
            << "\"estimated_effect\":" << jsonNumber(result.result.estimated_effect) << ','
            << "\"cost\":" << jsonNumber(result.total_cost) << ','
            << "\"risk\":" << jsonNumber(result.total_risk)
            << '}';
    };
    out << '{'
        << "\"lowest_cost_effective\":";
    writeSet(search.lowest_cost_effective);
    out << ",\"best_effective\":";
    writeSet(search.best_effective);
    out << '}';
}

void writeFmuConfigs(std::ostringstream& out, const std::vector<FmuComponentConfig>& configs) {
    out << '[';
    bool first = true;
    for (const auto& config : configs) {
        if (!first) out << ',';
        first = false;
        out << '{'
            << "\"id\":" << jsonString(config.id) << ','
            << "\"path\":" << jsonString(config.path) << ','
            << "\"step_size\":" << jsonNumber(config.step_size) << ','
            << "\"inputs\":[";
        for (std::size_t i = 0; i < config.inputs.size(); ++i) {
            if (i > 0) out << ',';
            out << '{'
                << "\"port\":" << jsonString(config.inputs[i].port) << ','
                << "\"world_path\":" << jsonString(config.inputs[i].world_path)
                << '}';
        }
        out << "],\"outputs\":[";
        for (std::size_t i = 0; i < config.outputs.size(); ++i) {
            if (i > 0) out << ',';
            out << '{'
                << "\"port\":" << jsonString(config.outputs[i].port) << ','
                << "\"world_path\":" << jsonString(config.outputs[i].world_path)
                << '}';
        }
        out << "]}";
    }
    out << ']';
}

void writeFmuPortValues(std::ostringstream& out, const std::vector<FmuPortRuntimeValue>& values) {
    out << '[';
    for (std::size_t i = 0; i < values.size(); ++i) {
        if (i > 0) out << ',';
        out << '{'
            << "\"port\":" << jsonString(values[i].port) << ','
            << "\"value\":" << jsonNumber(values[i].value)
            << '}';
    }
    out << ']';
}

void writeFmuRuntime(std::ostringstream& out, const std::vector<FmuRuntimeState>& runtime) {
    out << '[';
    bool first = true;
    for (const auto& state : runtime) {
        if (!first) out << ',';
        first = false;
        out << '{'
            << "\"id\":" << jsonString(state.id) << ','
            << "\"load_mode\":" << jsonString(state.load_mode) << ','
            << "\"initialized\":" << jsonBool(state.initialized) << ','
            << "\"last_step_time\":" << jsonNumber(state.last_step_time) << ','
            << "\"inputs\":";
        writeFmuPortValues(out, state.inputs);
        out << ",\"outputs\":";
        writeFmuPortValues(out, state.outputs);
        out << '}';
    }
    out << ']';
}

void writePythonScripts(std::ostringstream& out, const WorldState& world) {
    out << '[';
    bool first = true;
    for (const auto& [id, entity] : world.entities) {
        (void)id;
        for (const auto& script : entity.python_scripts) {
            if (!first) out << ',';
            first = false;
            const std::string script_id = scriptIdFor(script);
            const auto runtime_it = std::find_if(
                world.python_script_runtime.begin(),
                world.python_script_runtime.end(),
                [&](const PythonScriptRuntimeState& state) { return state.script_id == script_id; });
            out << '{'
                << "\"script_id\":" << jsonString(script_id) << ','
                << "\"object_id\":" << jsonString(script.object_id) << ','
                << "\"script_path\":" << jsonString(script.script_path) << ','
                << "\"class_name\":" << jsonString(script.class_name) << ','
                << "\"enabled\":" << jsonBool(script.enabled) << ','
                << "\"params\":{";
            bool first_param = true;
            for (const auto& [key, value] : script.params) {
                if (!first_param) out << ',';
                first_param = false;
                out << jsonString(key) << ':' << jsonString(value);
            }
            out << "},";
            if (runtime_it != world.python_script_runtime.end()) {
                out << "\"loaded\":" << jsonBool(runtime_it->loaded) << ','
                    << "\"last_reload_status\":" << jsonString(runtime_it->last_reload_status) << ','
                    << "\"last_error\":" << jsonString(runtime_it->last_error) << ','
                    << "\"last_tick\":" << runtime_it->last_tick << ','
                    << "\"emitted_events\":" << runtime_it->emitted_events << ','
                    << "\"proposed_coas\":" << runtime_it->proposed_coas << ','
                    << "\"scheduled_actions\":" << runtime_it->scheduled_actions;
            } else {
                out << "\"loaded\":false,\"last_reload_status\":\"not_loaded\",\"last_error\":\"\","
                    << "\"last_tick\":0,\"emitted_events\":0,\"proposed_coas\":0,\"scheduled_actions\":0";
            }
            out << '}';
        }
    }
    out << ']';
}

void writeCoaLog(std::ostringstream& out, const std::vector<CourseOfAction>& coa_log) {
    writeCoaLogJson(out, coa_log);
}

void writeEnvironment(std::ostringstream& out, const EnvironmentState& environment) {
    out << '{'
        << "\"theater\":" << jsonString(environment.theater) << ','
        << "\"weather_summary\":" << jsonString(environment.weather_summary) << ','
        << "\"visibility_km\":" << jsonNumber(environment.visibility_km) << ','
        << "\"wind_kts\":" << jsonNumber(environment.wind_kts) << ','
        << "\"wind_direction\":" << jsonString(environment.wind_direction) << ','
        << "\"sea_state\":" << environment.sea_state << ','
        << "\"weather_source\":" << jsonString(environment.weather_source)
        << '}';
}

void writeOpenData(std::ostringstream& out, const OpenDataConfig& open_data, std::size_t ais_track_count) {
    out << '{'
        << "\"data_mode\":" << jsonString(open_data.data_mode) << ','
        << "\"ais_tracks_path\":" << jsonString(open_data.ais_tracks_path) << ','
        << "\"weather_path\":" << jsonString(open_data.weather_path) << ','
        << "\"provenance_path\":" << jsonString(open_data.provenance_path) << ','
        << "\"ais_track_count\":" << ais_track_count
        << '}';
}

std::string buildDashboardJson(
    const ScenarioRun& baseline,
    const ScenarioRun& online,
    const std::vector<CredibilityAssessment>& assessments,
    const PlantedTruthScore& planted_score,
    const MinimumInterventionSearchResult& search,
    const EmergenceDetection& emergence,
    const CalibrationReport& calibration) {
    const auto claims = CausalClaimBuilder::build(baseline.kernel.events(), baseline.kernel.world());
  const auto graph = RelationshipGraph::fromScenario(baseline.scenario);

    std::ostringstream out;
    out << '{'
        << "\"scenario_id\":" << jsonString(baseline.scenario.config.scenario_id) << ','
        << "\"seed\":" << baseline.scenario.config.seed << ','
        << "\"max_ticks\":" << baseline.scenario.config.max_ticks << ','
        << "\"mission_cutoff\":" << baseline.scenario.mission.target_detected_before_tick << ','
        << "\"replay_hash\":" << jsonString(std::to_string(baseline.kernel.events().stableHash())) << ','
        << "\"baseline_metrics\":";
    writeMetrics(out, baseline.kernel.world().metrics);
    out << ",\"online_metrics\":";
    writeMetrics(out, online.kernel.world().metrics);
    out << ",\"events\":";
    writeEvents(out, online.kernel.events());
    out << ",\"relationships\":";
    writeRelationships(out, graph);
    out << ",\"temporal_causal_graph\":";
    writeCausalGraph(out, online.kernel.causalGraph());
    out << ",\"causal_debug\":";
    writeCausalDebug(out, online.kernel.world(), online.kernel.causalGraph(), online.kernel.events());
    out << ",\"entities\":";
    writeEntities(out, online.kernel.world());
    out << ",\"fmu_configs\":";
    writeFmuConfigs(out, online.kernel.world().fmu_configs);
    out << ",\"fmu_runtime\":";
    writeFmuRuntime(out, online.kernel.world().fmu_runtime);
    out << ",\"python_scripts\":";
    writePythonScripts(out, online.kernel.world());
    out << ",\"claims\":";
    writeClaims(out, claims);
    out << ",\"credibility_assessments\":";
    writeAssessments(out, assessments);
    out << ",\"intervention_search\":";
    writeInterventionSearch(out, search);
    out << ",\"planted_truth\":{"
        << "\"recovery_score\":" << jsonNumber(planted_score.recovery_score) << ','
        << "\"precision\":" << jsonNumber(planted_score.precision) << ','
        << "\"recall\":" << jsonNumber(planted_score.recall) << ','
        << "\"f1\":" << jsonNumber(planted_score.f1) << ','
        << "\"structural_hamming_distance\":" << planted_score.structural_hamming_distance << ','
        << "\"sign_accuracy\":" << jsonNumber(planted_score.sign_accuracy) << ','
        << "\"matched_edges\":[";
    for (std::size_t i = 0; i < planted_score.matched_edges.size(); ++i) {
        if (i > 0) out << ',';
        out << jsonString(planted_score.matched_edges[i]);
    }
    out << "],\"missing_edges\":[";
    for (std::size_t i = 0; i < planted_score.missing_edges.size(); ++i) {
        if (i > 0) out << ',';
        out << jsonString(planted_score.missing_edges[i]);
    }
    out << "]},";
    out << "\"calibration\":{"
        << "\"brier_score\":" << jsonNumber(calibration.brier_score) << ','
        << "\"log_loss\":" << jsonNumber(calibration.log_loss) << ','
        << "\"expected_calibration_error\":" << jsonNumber(calibration.expected_calibration_error) << ','
        << "\"outcome_samples\":" << calibration.outcome_samples << ','
        << "\"true_effect\":" << jsonNumber(calibration.true_effect) << ','
        << "\"mean_estimated_effect\":" << jsonNumber(calibration.mean_estimated_effect) << ','
        << "\"mean_ci_width\":" << jsonNumber(calibration.mean_ci_width) << ','
        << "\"ci_coverage\":" << jsonNumber(calibration.ci_coverage) << ','
        << "\"ci_experiments\":" << calibration.ci_experiments << ','
        << "\"calibration_error\":" << jsonNumber(calibration.calibration_error) << ','
        << "\"validation_score\":" << jsonNumber(calibration.validation_score) << ','
        << "\"uncertainty_score\":" << jsonNumber(calibration.uncertainty_score) << ','
        << "\"reliability\":[";
    for (std::size_t i = 0; i < calibration.reliability.size(); ++i) {
        if (i > 0) out << ',';
        out << "{\"mean_predicted\":" << jsonNumber(calibration.reliability[i].mean_predicted)
            << ",\"mean_observed\":" << jsonNumber(calibration.reliability[i].mean_observed)
            << ",\"count\":" << calibration.reliability[i].count << '}';
    }
    out << "]},";
    out << "\"emergence\":{"
        << "\"detected\":" << jsonBool(emergence.detected) << ','
        << "\"summary\":" << jsonString(emergence.summary) << ','
        << "\"patterns\":[";
    for (std::size_t i = 0; i < emergence.patterns.size(); ++i) {
        if (i > 0) out << ',';
        out << jsonString(emergence.patterns[i]);
    }
    out << "],\"metrics\":{"
        << "\"decision_latency\":" << jsonNumber(emergence.metrics.decision_latency) << ','
        << "\"sensor_trust\":" << jsonNumber(emergence.metrics.sensor_trust) << ','
        << "\"comms_congestion\":" << jsonNumber(emergence.metrics.comms_congestion) << ','
        << "\"mission_tempo_ratio\":" << jsonNumber(emergence.metrics.mission_tempo_ratio)
        << "}},";
    out << "\"async_validation\":{"
        << "\"completed\":" << jsonBool(online.has_async_summary) << ','
        << "\"agent_action\":" << jsonString(online.has_async_summary ? online.async_summary.agent_action : "") << ','
        << "\"falsification_survived\":" << jsonBool(online.has_async_summary && online.async_summary.falsification_survived) << ','
        << "\"falsification_summary\":" << jsonString(online.has_async_summary ? online.async_summary.falsification_summary : "") << ','
        << "\"lowest_cost_intervention\":" << jsonString(online.has_async_summary ? online.async_summary.lowest_cost_intervention : "") << ','
        << "\"best_effect_intervention\":" << jsonString(online.has_async_summary ? online.async_summary.best_effect_intervention : "") << ','
        << "\"planted_truth_recovery\":" << jsonNumber(online.has_async_summary ? online.async_summary.planted_truth_recovery : 0.0)
        << "},"
        << "\"authorization_mode\":" << jsonString(toString(online.kernel.world().authorization_mode)) << ','
        << "\"environment\":";
    writeEnvironment(out, baseline.scenario.environment);
    out << ",\"open_data\":";
    writeOpenData(out, baseline.scenario.open_data, baseline.scenario.ais_tracks.size());
    out << ",\"coa_log\":";
    writeCoaLog(out, online.kernel.world().coa_log);
    out << '}';
    return out.str();
}

} // namespace

int main(int argc, char** argv) {
    try {
        if (argc < 2) {
            std::cerr << "usage: sim-export <scenario.yaml> [--seed N] [--mode policy_auto|explicit|human_hold] [--approve action@tick] [--out file.json]\n";
            return 2;
        }

        ScenarioRunOptions options = parseScenarioRunOptions(argc, argv, 2);
        std::filesystem::path out_path;
        for (int i = 2; i < argc; ++i) {
            if (std::string(argv[i]) == "--out" && i + 1 < argc) {
                out_path = argv[i + 1];
            }
        }

        const auto baseline = runScenarioFile(std::filesystem::path(argv[1]), options.seed_override, false);
        const auto online = runScenarioFile(std::filesystem::path(argv[1]), options);

        const auto claims = CausalClaimBuilder::build(baseline.kernel.events(), baseline.kernel.world());
        CredibilityEngine credibility(std::filesystem::path(DARLA_SOURCE_DIR) / "models");
        auto assessments = credibility.assessClaims(
            claims,
            baseline.kernel.events(),
            baseline.degradation_snapshot,
            baseline.kernel.world().metrics,
            baseline.scenario.config.max_ticks);

        PlantedTruthScorer scorer;
        const auto planted_score = scorer.score(baseline.scenario.planted_causal_truth, claims);

        MinimumInterventionSearch search_engine;
        const auto search = search_engine.run(
            baseline.degradation_snapshot,
            baseline.kernel.world().metrics,
            baseline.scenario.config.max_ticks);

        EmergenceDetector emergence_detector;
        const auto emergence = emergence_detector.evaluate(baseline.kernel.world(), baseline.kernel.events());

        bool run_calibration = true;
        for (int i = 2; i < argc; ++i) {
            if (std::string(argv[i]) == "--no-calibrate") run_calibration = false;
        }
        CalibrationReport calibration;
        if (run_calibration) {
            CalibrationHarness harness;
            CalibrationConfig cal_config;
            cal_config.outcome_seeds = 24;
            cal_config.ci_experiments = 12;
            cal_config.ci_replicates = 16;
            calibration = harness.run(baseline.scenario, cal_config);

            // Populate the previously-unused credibility-contract fields with the
            // measured calibration / validation / uncertainty numbers.
            for (auto& assessment : assessments) {
                assessment.contract.calibration_error = calibration.calibration_error;
                assessment.contract.validation_score = calibration.validation_score;
                assessment.contract.uncertainty_score = calibration.uncertainty_score;
            }
        }

        const std::string json = buildDashboardJson(baseline, online, assessments, planted_score, search, emergence, calibration);

        if (!out_path.empty()) {
            std::ofstream out{out_path};
            if (!out) throw std::runtime_error("unable to write: " + out_path.string());
            out << json;
        } else {
            std::cout << json;
        }
        return 0;
    } catch (const std::exception& ex) {
        std::cerr << "sim-export error: " << ex.what() << '\n';
        return 1;
    }
}
