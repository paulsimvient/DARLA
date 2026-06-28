#include "sim-tools/SimFrameExporter.h"

#include "ActionType.h"
#include "Entity.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <iomanip>
#include <sstream>

namespace darla {
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

std::string causalEdgeTypeName(CausalEdgeType type) {
    switch (type) {
    case CausalEdgeType::Enables: return "enables";
    case CausalEdgeType::Degrades: return "degrades";
    case CausalEdgeType::Delays: return "delays";
    case CausalEdgeType::Suppresses: return "suppresses";
    case CausalEdgeType::Confounds: return "confounds";
    case CausalEdgeType::Observes: return "observes";
    case CausalEdgeType::Commands: return "commands";
    case CausalEdgeType::DependsOn: return "depends_on";
    case CausalEdgeType::CausesMissionEffect: return "causes_mission_effect";
    }
    return "unknown";
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

void writeEvent(std::ostringstream& out, const SimEvent& event) {
    out << '{'
        << "\"event_id\":" << event.event_id << ','
        << "\"tick\":" << event.tick << ','
        << "\"actor\":" << event.actor << ','
        << "\"type\":" << jsonString(toString(event.type)) << ','
        << "\"label\":" << jsonString(event.label) << ','
        << "\"confidence\":" << jsonNumber(event.confidence) << ','
        << "\"provenance\":" << jsonString(event.provenance) << ','
        << "\"causal_parent_count\":" << event.causal_parent_events.size() << ','
        << "\"deltas\":[";
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

void writeAgentBeliefs(std::ostringstream& out, const AgentBeliefRegistry& beliefs) {
    out << "{"
        << "\"sensor_trust\":" << jsonNumber(beliefs.sensor.trust) << ','
        << "\"sensor_degraded\":" << jsonBool(beliefs.sensor.degraded) << ','
        << "\"comms_health\":" << jsonNumber(beliefs.comms.health) << ','
        << "\"mission_risk\":" << jsonNumber(beliefs.commander.mission_risk) << ','
        << "\"tempo_ratio\":" << jsonNumber(beliefs.commander.tempo_ratio) << ','
        << "\"coa_entropy\":" << jsonNumber(beliefs.commander.coa_entropy) << ','
        << "\"causal_warning\":" << jsonBool(beliefs.causal_monitor.emergence_warning) << ','
        << "\"credibility_valid\":" << jsonBool(beliefs.credibility.validity_ok)
        << '}';
}

void writeBudgets(std::ostringstream& out, const WorldState& world) {
    out << "{"
        << "\"agent_decisions\":" << world.runtime_budgets.tick_usage.agent_decisions << ','
        << "\"causal_queries\":" << world.runtime_budgets.tick_usage.causal_queries << ','
        << "\"async_replay_jobs\":" << world.runtime_budgets.tick_usage.async_replay_jobs << ','
        << "\"async_branch_executions\":" << world.runtime_budgets.tick_usage.async_branch_executions
        << '}';
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

void writeCoaEvidence(std::ostringstream& out, const CoaEvidence& evidence) {
    out << '{'
        << "\"source_event_ids\":[";
    for (std::size_t i = 0; i < evidence.source_event_ids.size(); ++i) {
        if (i > 0) out << ',';
        out << evidence.source_event_ids[i];
    }
    out << "],\"causal_edge_ids\":[";
    for (std::size_t i = 0; i < evidence.causal_edge_ids.size(); ++i) {
        if (i > 0) out << ',';
        out << jsonString(evidence.causal_edge_ids[i]);
    }
    out << "],\"dominant_path\":[";
    for (std::size_t i = 0; i < evidence.dominant_path.size(); ++i) {
        if (i > 0) out << ',';
        const auto& node = evidence.dominant_path[i];
        out << '{'
            << "\"node_id\":" << jsonString(node.node_id) << ','
            << "\"label\":" << jsonString(node.label) << ','
            << "\"type\":" << jsonString(node.type) << ','
            << "\"confidence\":" << jsonNumber(node.confidence) << ','
            << "\"tick\":" << node.tick
            << '}';
    }
    out << "],\"falsification_summary\":" << jsonString(evidence.falsification_summary) << ','
        << "\"replay_hash\":" << jsonString(evidence.replay_hash)
        << '}';
}

void writeCoaEntry(std::ostringstream& out, const CourseOfAction& coa) {
    out << '{'
        << "\"id\":" << coa.id << ','
        << "\"proposed_tick\":" << coa.proposed_tick << ','
        << "\"action\":" << jsonString(toString(coa.action)) << ','
        << "\"target\":" << jsonString(coa.target) << ','
        << "\"expected_mission_gain\":" << jsonNumber(coa.expected_mission_gain) << ','
        << "\"causal_confidence\":" << jsonNumber(coa.causal_confidence) << ','
        << "\"cost\":" << jsonNumber(coa.cost) << ','
        << "\"risk\":" << jsonNumber(coa.risk) << ','
        << "\"score\":" << jsonNumber(coa.score) << ','
        << "\"rationale\":" << jsonString(coa.rationale) << ','
        << "\"evidence\":";
    writeCoaEvidence(out, coa.evidence);
    out << ",\"status\":" << jsonString(toString(coa.status)) << ','
        << "\"scheduled_at_tick\":" << coa.scheduled_at_tick
        << '}';
}

const CourseOfAction* findActiveCoa(const WorldState& world) {
    if (world.agent_beliefs.commander.active_coa_id > 0) {
        for (const auto& coa : world.coa_log) {
            if (coa.id == world.agent_beliefs.commander.active_coa_id) {
                return &coa;
            }
        }
    }
    for (auto it = world.coa_log.rbegin(); it != world.coa_log.rend(); ++it) {
        if (it->status == CoaStatus::Executing || it->status == CoaStatus::Approved) {
            return &(*it);
        }
    }
    return nullptr;
}

std::vector<const CourseOfAction*> recommendationsAtTick(const WorldState& world, Tick tick) {
    std::vector<const CourseOfAction*> ranked;
    Tick latest_review = 0;
    for (const auto& coa : world.coa_log) {
        if (coa.proposed_tick <= tick && coa.proposed_tick >= latest_review) {
            latest_review = coa.proposed_tick;
        }
    }
    if (latest_review == 0) {
        return ranked;
    }
    for (const auto& coa : world.coa_log) {
        if (coa.proposed_tick != latest_review) continue;
        if (coa.status == CoaStatus::Superseded || coa.status == CoaStatus::Rejected) continue;
        ranked.push_back(&coa);
    }
    std::sort(ranked.begin(), ranked.end(), [](const CourseOfAction* lhs, const CourseOfAction* rhs) {
        if (lhs->action == ActionType::HoldCurrentCOA) return false;
        if (rhs->action == ActionType::HoldCurrentCOA) return true;
        return lhs->score > rhs->score;
    });
    return ranked;
}

void writeAuthorityStatus(std::ostringstream& out, const WorldState& world) {
    std::size_t pending = 0;
    for (const auto& coa : world.coa_log) {
        if (coa.status == CoaStatus::Recommended || coa.status == CoaStatus::Proposed) {
            ++pending;
        }
    }
    out << '{'
        << "\"mode\":" << jsonString(toString(world.authorization_mode)) << ','
        << "\"pending_recommendations\":" << pending << ','
        << "\"active_coa_id\":" << world.agent_beliefs.commander.active_coa_id << ','
        << "\"primary_decision_recorded\":" << jsonBool(world.agent_beliefs.commander.primary_decision_recorded)
        << '}';
}

void writeTemporalCausalEdges(std::ostringstream& out, const TemporalCausalGraph& graph) {
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

std::vector<std::array<double, 2>> circlePolygon(double lon, double lat, double radius_km, int points = 32) {
    std::vector<std::array<double, 2>> coords;
    const double earth_radius_km = 6371.0;
    const double lat_rad = lat * M_PI / 180.0;
    const double lon_rad = lon * M_PI / 180.0;
    const double d = radius_km / earth_radius_km;
    for (int i = 0; i <= points; ++i) {
        const double bearing = (static_cast<double>(i) / points) * 2.0 * M_PI;
        const double lat2 = std::asin(
            std::sin(lat_rad) * std::cos(d) + std::cos(lat_rad) * std::sin(d) * std::cos(bearing));
        const double lon2 = lon_rad + std::atan2(
            std::sin(bearing) * std::sin(d) * std::cos(lat_rad),
            std::cos(d) - std::sin(lat_rad) * std::sin(lat2));
        coords.push_back({lon2 * 180.0 / M_PI, lat2 * 180.0 / M_PI});
    }
    return coords;
}

void writeMapOverlays(std::ostringstream& out, Tick tick, const WorldState& world) {
    out << '[';
    bool first = true;

    if (world.cyber_degradation_applied) {
        for (const auto& [id, entity] : world.entities) {
            if (entity.side != "red" || !entity.kinematic) continue;
            out << (first ? "" : ",");
            first = false;
            const auto ring = circlePolygon(entity.kinematic->lon, entity.kinematic->lat, 25.0);
            out << '{'
                << "\"id\":" << jsonString("risk-zone-cyber-" + entity.name) << ','
                << "\"tick\":" << tick << ','
                << "\"source\":" << jsonString("event") << ','
                << "\"entity_id\":" << jsonString(entity.name) << ','
                << "\"geometry\":{\"type\":\"Polygon\",\"coordinates\":[[";
            for (std::size_t i = 0; i < ring.size(); ++i) {
                if (i > 0) out << ',';
                out << '[' << jsonNumber(ring[i][0]) << ',' << jsonNumber(ring[i][1]) << ']';
            }
            out << "]]},\"style\":" << jsonString("risk_zone") << ','
                << "\"label\":" << jsonString("Cyber effect area") << ','
                << "\"confidence\":0.75}";
        }
    }

    for (const auto& coa : world.coa_log) {
        if (coa.status != CoaStatus::Executing && coa.status != CoaStatus::Approved &&
            coa.status != CoaStatus::Recommended) {
            continue;
        }
        const Entity* target = world.entityByName(coa.target);
        if (!target || !target->kinematic) continue;

        out << (first ? "" : ",");
        first = false;
        const double radius = coa.status == CoaStatus::Executing ? 8.0 : 5.0;
        const auto ring = circlePolygon(target->kinematic->lon, target->kinematic->lat, radius);
        const std::string style =
            coa.status == CoaStatus::Executing ? "intervention" : "effect_area";
        out << '{'
            << "\"id\":" << jsonString("coa-overlay-" + std::to_string(coa.id)) << ','
            << "\"tick\":" << tick << ','
            << "\"source\":" << jsonString("coa") << ','
            << "\"coa_id\":" << coa.id << ','
            << "\"entity_id\":" << jsonString(coa.target) << ','
            << "\"geometry\":{\"type\":\"Polygon\",\"coordinates\":[[";
        for (std::size_t i = 0; i < ring.size(); ++i) {
            if (i > 0) out << ',';
            out << '[' << jsonNumber(ring[i][0]) << ',' << jsonNumber(ring[i][1]) << ']';
        }
        out << "]]},\"style\":" << jsonString(style) << ','
            << "\"label\":" << jsonString(toString(coa.action) + " on " + coa.target) << ','
            << "\"confidence\":" << jsonNumber(coa.causal_confidence)
            << '}';
    }

    for (const auto& track : world.ais_tracks) {
        if (track.points.size() < 2) continue;
        out << (first ? "" : ",");
        first = false;
        out << '{'
            << "\"id\":" << jsonString("ais-route-" + track.mmsi) << ','
            << "\"tick\":" << tick << ','
            << "\"source\":" << jsonString("ais") << ','
            << "\"entity_id\":" << jsonString(track.mmsi) << ','
            << "\"geometry\":{\"type\":\"LineString\",\"coordinates\":[";
        for (std::size_t i = 0; i < track.points.size(); ++i) {
            if (i > 0) out << ',';
            out << '[' << jsonNumber(track.points[i].lon) << ',' << jsonNumber(track.points[i].lat) << ']';
        }
        out << "]},\"style\":" << jsonString("route") << ','
            << "\"label\":" << jsonString(track.name) << ','
            << "\"confidence\":0.95"
            << '}';
    }

    out << ']';
}

} // namespace

std::string buildRunMetaJson(
    const std::string& scenario_id,
    std::uint64_t seed,
    AuthorizationMode authorization_mode,
    Tick max_ticks,
    double tick_seconds,
    Tick mission_cutoff,
    const FrameBuildOptions& options) {
    std::ostringstream meta;
    meta << '{'
         << "\"scenario_id\":" << jsonString(scenario_id) << ','
         << "\"seed\":" << seed << ','
         << "\"authorization_mode\":" << jsonString(toString(authorization_mode)) << ','
         << "\"max_ticks\":" << max_ticks << ','
         << "\"tick_seconds\":" << jsonNumber(tick_seconds) << ','
         << "\"mission_cutoff\":" << mission_cutoff;
    if (!options.run_id.empty()) {
        meta << ",\"run_id\":" << jsonString(options.run_id);
    }
    if (!options.branch_id.empty()) {
        meta << ",\"branch_id\":" << jsonString(options.branch_id);
    }
    if (!options.parent_run_id.empty()) {
        meta << ",\"parent_run_id\":" << jsonString(options.parent_run_id);
    }
    if (options.replay_hash != 0) {
        meta << ",\"replay_hash\":" << jsonString(std::to_string(options.replay_hash));
    }
    meta << '}';
    return meta.str();
}

std::string buildSimFrameJson(
    Tick tick,
    const WorldState& world,
    const std::vector<const SimEvent*>& tick_events,
    const TemporalCausalGraph* causal_graph,
    const FrameBuildOptions& options) {
    std::ostringstream out;
    out << '{'
        << "\"tick\":" << tick << ','
        << "\"metrics\":";
    writeMetrics(out, world.metrics);
    out << ",\"entities\":";
    writeEntities(out, world);
    out << ",\"agent_beliefs\":";
    writeAgentBeliefs(out, world.agent_beliefs);
    out << ",\"authority_status\":";
    writeAuthorityStatus(out, world);
    out << ",\"active_coa\":";
    if (const auto* active = findActiveCoa(world)) {
        writeCoaEntry(out, *active);
    } else {
        out << "null";
    }
    out << ",\"coa_recommendations\":[";
    const auto recommendations = recommendationsAtTick(world, tick);
    for (std::size_t i = 0; i < recommendations.size(); ++i) {
        if (i > 0) out << ',';
        writeCoaEntry(out, *recommendations[i]);
    }
    out << "],\"events\":[";
    for (std::size_t i = 0; i < tick_events.size(); ++i) {
        if (i > 0) out << ',';
        writeEvent(out, *tick_events[i]);
    }
    out << "],\"temporal_causal_edges\":";
    if (causal_graph) {
        writeTemporalCausalEdges(out, *causal_graph);
    } else {
        out << "[]";
    }
    out << ",\"map_overlays\":";
    writeMapOverlays(out, tick, world);
    if (options.include_budgets) {
        out << ",\"budgets\":";
        writeBudgets(out, world);
    }
    out << ",\"python_scripts\":";
    writePythonScripts(out, world);
    if (!options.run_id.empty()) {
        out << ",\"run_id\":" << jsonString(options.run_id);
    }
    if (!options.branch_id.empty()) {
        out << ",\"branch_id\":" << jsonString(options.branch_id);
    }
    if (options.replay_hash != 0) {
        out << ",\"replay_hash\":" << jsonString(std::to_string(options.replay_hash));
    }
    out << ",\"authorization_mode\":" << jsonString(toString(world.authorization_mode));
    out << ",\"current_tick\":" << tick;
    out << '}';
    return out.str();
}

void writeCoaLogJson(std::ostringstream& out, const std::vector<CourseOfAction>& coa_log) {
    out << '[';
    bool first = true;
    for (const auto& coa : coa_log) {
        if (!first) out << ',';
        first = false;
        writeCoaEntry(out, coa);
    }
    out << ']';
}

} // namespace darla
