#include "ScenarioLoader.h"

#include "RelationshipTypes.h"

#include <algorithm>
#include <cctype>
#include <fstream>
#include <sstream>
#include <stdexcept>
#include <unordered_map>

namespace darla {
namespace {

std::string trim(std::string value) {
    auto not_space = [](unsigned char c) { return !std::isspace(c); };
    value.erase(value.begin(), std::find_if(value.begin(), value.end(), not_space));
    value.erase(std::find_if(value.rbegin(), value.rend(), not_space).base(), value.end());
    return value;
}

std::string afterColon(const std::string& line) {
    const auto pos = line.find(':');
    if (pos == std::string::npos) {
        return {};
    }
    return trim(line.substr(pos + 1));
}

bool isTrue(const std::string& value) {
    return value == "true" || value == "True" || value == "yes";
}

EntityId stableEntityId(const std::string& name) {
    std::uint64_t h = 1469598103934665603ull;
    for (unsigned char c : name) {
        h ^= c;
        h *= 1099511628211ull;
    }
    return h == 0 ? 1 : h;
}

std::vector<std::string> splitCsvLine(const std::string& line) {
    std::vector<std::string> fields;
    std::string field;
    std::istringstream stream(line);
    while (std::getline(stream, field, ',')) {
        fields.push_back(trim(field));
    }
    return fields;
}

std::vector<AisTrack> loadAisTracksFromCsv(const std::filesystem::path& path) {
    std::ifstream in(path);
    if (!in) {
        throw std::runtime_error("unable to open AIS tracks: " + path.string());
    }

    std::unordered_map<std::string, AisTrack> tracks_by_mmsi;
    std::string raw;
    bool header_skipped = false;
    while (std::getline(in, raw)) {
        const std::string line = trim(raw);
        if (line.empty() || line[0] == '#') continue;
        const auto fields = splitCsvLine(line);
        if (!header_skipped) {
            header_skipped = true;
            if (!fields.empty() && fields[0] == "mmsi") continue;
        }
        if (fields.size() < 6) continue;

        AisTrackPoint point;
        point.lat = std::stod(fields[2]);
        point.lon = std::stod(fields[3]);

        auto& track = tracks_by_mmsi[fields[0]];
        if (track.mmsi.empty()) {
            track.mmsi = fields[0];
            track.name = fields[1];
        }
        track.points.push_back(point);
    }

    std::vector<AisTrack> tracks;
    tracks.reserve(tracks_by_mmsi.size());
    for (auto& [mmsi, track] : tracks_by_mmsi) {
        tracks.push_back(std::move(track));
    }
    std::sort(tracks.begin(), tracks.end(), [](const AisTrack& a, const AisTrack& b) {
        return a.mmsi < b.mmsi;
    });
    return tracks;
}

} // namespace

EntityKind entityKindFromString(const std::string& value) {
    if (value == "Platform") return EntityKind::Platform;
    if (value == "Sensor") return EntityKind::Sensor;
    if (value == "Weapon") return EntityKind::Weapon;
    if (value == "NetworkNode") return EntityKind::NetworkNode;
    if (value == "LogisticsNode") return EntityKind::LogisticsNode;
    if (value == "Commander") return EntityKind::Commander;
    if (value == "CyberService") return EntityKind::CyberService;
    if (value == "CivilianInfrastructure") return EntityKind::CivilianInfrastructure;
    if (value == "TerrainFeature") return EntityKind::TerrainFeature;
    if (value == "MissionObjective") return EntityKind::MissionObjective;
    return EntityKind::Unit;
}

std::string toString(EntityKind kind) {
    switch (kind) {
    case EntityKind::Platform: return "Platform";
    case EntityKind::Sensor: return "Sensor";
    case EntityKind::Weapon: return "Weapon";
    case EntityKind::NetworkNode: return "NetworkNode";
    case EntityKind::LogisticsNode: return "LogisticsNode";
    case EntityKind::Commander: return "Commander";
    case EntityKind::CyberService: return "CyberService";
    case EntityKind::CivilianInfrastructure: return "CivilianInfrastructure";
    case EntityKind::TerrainFeature: return "TerrainFeature";
    case EntityKind::MissionObjective: return "MissionObjective";
    case EntityKind::Unit: return "Unit";
    }
    return "Unit";
}

Entity* WorldState::entityByName(const std::string& name) {
    const auto it = ids_by_name.find(name);
    if (it == ids_by_name.end()) return nullptr;
    const auto entity_it = entities.find(it->second);
    if (entity_it == entities.end()) return nullptr;
    return &entity_it->second;
}

const Entity* WorldState::entityByName(const std::string& name) const {
    const auto it = ids_by_name.find(name);
    if (it == ids_by_name.end()) return nullptr;
    const auto entity_it = entities.find(it->second);
    if (entity_it == entities.end()) return nullptr;
    return &entity_it->second;
}

Scenario ScenarioLoader::load(const std::filesystem::path& path) const {
    std::ifstream in(path);
    if (!in) {
        throw std::runtime_error("unable to open scenario: " + path.string());
    }

    Scenario scenario;
    FmuComponentConfig* current_fmu = nullptr;
    Entity* current_entity = nullptr;
    PythonScriptConfig* current_python_script = nullptr;
    ScriptedEvent* current_scripted = nullptr;
    std::string component;
    bool in_entities = false;
    bool in_scripted = false;
    bool in_relationships = false;
    bool in_planted_truth = false;
    bool in_fmus = false;
    bool in_fmu_inputs = false;
    bool in_fmu_outputs = false;
    bool in_python_params = false;
    bool in_success_conditions = false;
    bool in_effect = false;
    bool in_timeline = false;
    bool in_open_data = false;
    bool in_environment = false;
    bool in_scm = false;

    std::string raw;
    while (std::getline(in, raw)) {
        const std::string line = trim(raw);
        if (line.empty() || line[0] == '#') continue;

        if (line == "entities:") {
            in_entities = true; in_scripted = false; in_relationships = false; in_planted_truth = false; in_fmus = false; in_success_conditions = false; in_effect = false; in_timeline = false; in_open_data = false; in_environment = false; in_scm = false; current_entity = nullptr; current_python_script = nullptr; current_scripted = nullptr; current_fmu = nullptr; in_python_params = false; continue;
        }
        if (line == "scripted_events:") {
            in_scripted = true; in_entities = false; in_success_conditions = false; in_effect = false; in_timeline = false; in_open_data = false; in_environment = false; in_relationships = false; in_planted_truth = false; in_fmus = false; in_scm = false; current_entity = nullptr; current_python_script = nullptr; current_scripted = nullptr; current_fmu = nullptr; in_python_params = false; continue;
        }
        if (line == "relationships:") {
            in_relationships = true; in_entities = false; in_scripted = false; in_success_conditions = false; in_effect = false; in_timeline = false; in_open_data = false; in_environment = false; in_planted_truth = false; in_fmus = false; in_scm = false; current_entity = nullptr; current_python_script = nullptr; current_scripted = nullptr; current_fmu = nullptr; in_python_params = false; continue;
        }
        if (line == "planted_causal_truth:") {
            in_planted_truth = true; in_entities = false; in_scripted = false; in_relationships = false; in_fmus = false; in_success_conditions = false; in_effect = false; in_timeline = false; in_open_data = false; in_environment = false; in_scm = false; current_entity = nullptr; current_python_script = nullptr; current_scripted = nullptr; current_fmu = nullptr; in_python_params = false; continue;
        }
        if (line == "fmus:") {
            in_fmus = true; in_entities = false; in_scripted = false; in_relationships = false; in_planted_truth = false; in_success_conditions = false; in_effect = false; in_timeline = false; in_open_data = false; in_environment = false; in_scm = false; current_entity = nullptr; current_python_script = nullptr; current_scripted = nullptr; current_fmu = nullptr; in_fmu_inputs = false; in_fmu_outputs = false; in_python_params = false; continue;
        }
        if (line == "scm:") {
            in_scm = true; in_entities = false; in_scripted = false; in_relationships = false; in_planted_truth = false; in_fmus = false; in_success_conditions = false; in_effect = false; in_timeline = false; in_open_data = false; in_environment = false; current_entity = nullptr; current_python_script = nullptr; current_scripted = nullptr; current_fmu = nullptr; in_python_params = false; continue;
        }
        if (line == "success_conditions:") {
            in_success_conditions = true; continue;
        }
        if (line == "effect:") {
            in_effect = true; continue;
        }
        if (line == "timeline:") {
            in_timeline = true;
            in_entities = false;
            in_scripted = false;
            in_relationships = false;
            in_planted_truth = false;
            in_fmus = false;
            in_success_conditions = false;
            in_effect = false;
            in_open_data = false;
            in_environment = false;
            in_scm = false;
            continue;
        }
        if (line == "open_data:") {
            in_open_data = true;
            in_environment = false;
            in_entities = false;
            in_scripted = false;
            in_relationships = false;
            in_planted_truth = false;
            in_fmus = false;
            in_success_conditions = false;
            in_effect = false;
            in_timeline = false;
            in_scm = false;
            continue;
        }
        if (line == "environment:") {
            in_environment = true;
            in_open_data = false;
            in_entities = false;
            in_scripted = false;
            in_relationships = false;
            in_planted_truth = false;
            in_fmus = false;
            in_success_conditions = false;
            in_effect = false;
            in_timeline = false;
            in_scm = false;
            continue;
        }
        if (line == "mission:") {
            in_entities = false;
            in_scripted = false;
            in_relationships = false;
            in_planted_truth = false;
            in_fmus = false;
            in_success_conditions = false;
            in_effect = false;
            in_timeline = false;
            in_open_data = false;
            in_environment = false;
            in_scm = false;
            continue;
        }
        if (line == "components:") continue;

        if (in_timeline) {
            if (line.rfind("pause_at_coa_reviews:", 0) == 0) {
                scenario.timeline.pause_at_coa_reviews = isTrue(afterColon(line));
            } else if (line.rfind("tick_pacing_ms:", 0) == 0) {
                scenario.timeline.tick_pacing_ms = std::stoi(afterColon(line));
            }
            continue;
        }

        if (in_open_data) {
            if (line.rfind("ais_tracks:", 0) == 0) scenario.open_data.ais_tracks_path = afterColon(line);
            else if (line.rfind("weather:", 0) == 0) scenario.open_data.weather_path = afterColon(line);
            else if (line.rfind("provenance:", 0) == 0) scenario.open_data.provenance_path = afterColon(line);
            else if (line.rfind("data_mode:", 0) == 0) scenario.open_data.data_mode = afterColon(line);
            continue;
        }

        if (in_scm) {
            ScmParameters& scm = scenario.scm;
            if (line.rfind("sensor_beta_cyber:", 0) == 0) scm.sensor_beta_cyber = std::stod(afterColon(line));
            else if (line.rfind("sensor_sigma:", 0) == 0) scm.sensor_sigma = std::stod(afterColon(line));
            else if (line.rfind("detection_nominal:", 0) == 0) scm.detection_nominal = std::stod(afterColon(line));
            else if (line.rfind("detection_comms_blocking:", 0) == 0) scm.detection_comms_blocking = std::stod(afterColon(line));
            else if (line.rfind("detection_degraded_autonomous:", 0) == 0) scm.detection_degraded_autonomous = std::stod(afterColon(line));
            else if (line.rfind("detection_degraded:", 0) == 0) scm.detection_degraded = std::stod(afterColon(line));
            else if (line.rfind("detection_isolated_autonomous:", 0) == 0) scm.detection_isolated_autonomous = std::stod(afterColon(line));
            else if (line.rfind("detection_isolated:", 0) == 0) scm.detection_isolated = std::stod(afterColon(line));
            else if (line.rfind("detection_sigma:", 0) == 0) scm.detection_sigma = std::stod(afterColon(line));
            else if (line.rfind("mission_fail_score:", 0) == 0) scm.mission_fail_score = std::stod(afterColon(line));
            else if (line.rfind("mission_success_autonomous_isolated:", 0) == 0) scm.mission_success_autonomous_isolated = std::stod(afterColon(line));
            else if (line.rfind("mission_success_score:", 0) == 0) scm.mission_success_score = std::stod(afterColon(line));
            else if (line.rfind("mission_preauth_floor:", 0) == 0) scm.mission_preauth_floor = std::stod(afterColon(line));
            else if (line.rfind("mission_sigma:", 0) == 0) scm.mission_sigma = std::stod(afterColon(line));
            else if (line.rfind("latent_confounder_strength:", 0) == 0) scm.latent_confounder_strength = std::stod(afterColon(line));
            continue;
        }

        if (in_environment) {
            if (line.rfind("theater:", 0) == 0) scenario.environment.theater = afterColon(line);
            else if (line.rfind("weather_summary:", 0) == 0) scenario.environment.weather_summary = afterColon(line);
            else if (line.rfind("visibility_km:", 0) == 0) scenario.environment.visibility_km = std::stod(afterColon(line));
            else if (line.rfind("wind_kts:", 0) == 0) scenario.environment.wind_kts = std::stod(afterColon(line));
            else if (line.rfind("wind_direction:", 0) == 0) scenario.environment.wind_direction = afterColon(line);
            else if (line.rfind("sea_state:", 0) == 0) scenario.environment.sea_state = std::stoi(afterColon(line));
            else if (line.rfind("weather_source:", 0) == 0) scenario.environment.weather_source = afterColon(line);
            continue;
        }

        if (!in_entities && !in_scripted && !in_relationships && !in_planted_truth && !in_fmus && !in_scm) {
            if (line.rfind("scenario_id:", 0) == 0) scenario.config.scenario_id = afterColon(line);
            else if (line.rfind("seed:", 0) == 0) scenario.config.seed = std::stoull(afterColon(line));
            else if (line.rfind("tick_seconds:", 0) == 0) scenario.config.tick_seconds = std::stod(afterColon(line));
            else if (line.rfind("max_ticks:", 0) == 0) scenario.config.max_ticks = std::stoull(afterColon(line));
            else if (line.rfind("objective:", 0) == 0) scenario.mission.objective = afterColon(line);
            else if (line.rfind("- target_detected_before_tick:", 0) == 0) scenario.mission.target_detected_before_tick = std::stoull(afterColon(line));
            else if (line.rfind("- track_confidence_min:", 0) == 0) scenario.mission.track_confidence_min = std::stod(afterColon(line));
            else if (line.rfind("- engagement_authority_available:", 0) == 0) scenario.mission.engagement_authority_available = isTrue(afterColon(line));
            continue;
        }

        if (in_entities) {
            if (line.rfind("- id:", 0) == 0) {
                Entity entity;
                entity.name = afterColon(line);
                entity.id = stableEntityId(entity.name);
                scenario.entities.push_back(entity);
                current_entity = &scenario.entities.back();
                current_python_script = nullptr;
                component.clear();
                in_python_params = false;
                continue;
            }
            if (!current_entity) continue;
            if (line.rfind("- type:", 0) == 0) {
                component = afterColon(line);
                in_python_params = false;
                current_python_script = nullptr;
                if (component == "kinematic") current_entity->kinematic.emplace();
                else if (component == "sensor") current_entity->sensor.emplace();
                else if (component == "comms") current_entity->comms.emplace();
                else if (component == "cyber") current_entity->cyber.emplace();
                else if (component == "mission") current_entity->mission.emplace();
                else if (component == "python_script") {
                    PythonScriptConfig config;
                    config.object_id = current_entity->name;
                    current_entity->python_scripts.push_back(config);
                    current_python_script = &current_entity->python_scripts.back();
                }
                continue;
            }
            if (line.rfind("kind:", 0) == 0) current_entity->kind = entityKindFromString(afterColon(line));
            else if (line.rfind("side:", 0) == 0) current_entity->side = afterColon(line);
            else if (line == "kinematic:") { current_entity->kinematic.emplace(); component = "kinematic"; current_python_script = nullptr; in_python_params = false; }
            else if (line == "sensor:") { current_entity->sensor.emplace(); component = "sensor"; current_python_script = nullptr; in_python_params = false; }
            else if (line == "comms:") { current_entity->comms.emplace(); component = "comms"; current_python_script = nullptr; in_python_params = false; }
            else if (line == "cyber:") { current_entity->cyber.emplace(); component = "cyber"; current_python_script = nullptr; in_python_params = false; }
            else if (line == "mission:") { current_entity->mission.emplace(); component = "mission"; current_python_script = nullptr; in_python_params = false; }
            else if (line.rfind("script:", 0) == 0 && current_python_script) current_python_script->script_path = afterColon(line);
            else if (line.rfind("class:", 0) == 0 && current_python_script) current_python_script->class_name = afterColon(line);
            else if (line.rfind("enabled:", 0) == 0 && current_python_script) current_python_script->enabled = isTrue(afterColon(line));
            else if (line == "params:" && current_python_script) in_python_params = true;
            else if (in_python_params && current_python_script && line.find(':') != std::string::npos) {
                const auto pos = line.find(':');
                current_python_script->params[trim(line.substr(0, pos))] = trim(line.substr(pos + 1));
            }
            else if (line.rfind("lat:", 0) == 0 && current_entity->kinematic) current_entity->kinematic->lat = std::stod(afterColon(line));
            else if (line.rfind("lon:", 0) == 0 && current_entity->kinematic) current_entity->kinematic->lon = std::stod(afterColon(line));
            else if (line.rfind("alt:", 0) == 0 && current_entity->kinematic) current_entity->kinematic->alt = std::stod(afterColon(line));
            else if (line.rfind("confidence:", 0) == 0 && current_entity->sensor && component == "sensor") current_entity->sensor->confidence = std::stod(afterColon(line));
            else if (line.rfind("range_km:", 0) == 0 && current_entity->sensor) current_entity->sensor->range_km = std::stod(afterColon(line));
            else if (line.rfind("latency_sec:", 0) == 0) {
                if (component == "sensor" && current_entity->sensor) current_entity->sensor->latency_sec = std::stod(afterColon(line));
                if (component == "comms" && current_entity->comms) current_entity->comms->latency_sec = std::stod(afterColon(line));
            }
            else if (line.rfind("bandwidth_mbps:", 0) == 0 && current_entity->comms) current_entity->comms->bandwidth_mbps = std::stod(afterColon(line));
            else if (line.rfind("packet_loss:", 0) == 0 && current_entity->comms) current_entity->comms->packet_loss = std::stod(afterColon(line));
            else if (line.rfind("integrity:", 0) == 0 && current_entity->cyber) current_entity->cyber->integrity = std::stod(afterColon(line));
            continue;
        }

        if (in_scripted) {
            if (line.rfind("- tick:", 0) == 0) {
                ScriptedEvent event;
                event.tick = std::stoull(afterColon(line));
                scenario.scripted_events.push_back(event);
                current_scripted = &scenario.scripted_events.back();
                in_effect = false;
                continue;
            }
            if (!current_scripted) continue;
            if (line.rfind("actor:", 0) == 0) current_scripted->actor = afterColon(line);
            else if (line.rfind("action:", 0) == 0) current_scripted->action = afterColon(line);
            else if (line.rfind("target:", 0) == 0) current_scripted->target = afterColon(line);
            else if (line.rfind("sensor_confidence_delta:", 0) == 0 && in_effect) current_scripted->sensor_confidence_delta = std::stod(afterColon(line));
            else if (line.rfind("network_integrity_delta:", 0) == 0 && in_effect) current_scripted->network_integrity_delta = std::stod(afterColon(line));
        }

        if (in_relationships) {
            if (line.rfind("- type:", 0) == 0) {
                RelationshipEdge edge;
                edge.type = relationshipTypeFromString(afterColon(line));
                scenario.relationships.push_back(edge);
                continue;
            }
            if (scenario.relationships.empty()) continue;
            RelationshipEdge& edge = scenario.relationships.back();
            if (line.rfind("source:", 0) == 0) edge.source = afterColon(line);
            else if (line.rfind("target:", 0) == 0) edge.target = afterColon(line);
            else if (line.rfind("component:", 0) == 0) edge.component = afterColon(line);
        }

        if (in_planted_truth) {
            if (line.rfind("- ", 0) != 0) continue;
            const std::string edge_text = trim(line.substr(2));
            const auto arrow = edge_text.find("->");
            if (arrow == std::string::npos) continue;
            PlantedCausalEdge edge;
            edge.cause = trim(edge_text.substr(0, arrow));
            edge.effect = trim(edge_text.substr(arrow + 2));
            scenario.planted_causal_truth.push_back(edge);
        }

        if (in_fmus) {
            if (line.rfind("- id:", 0) == 0) {
                FmuComponentConfig config;
                config.id = afterColon(line);
                scenario.fmus.push_back(config);
                current_fmu = &scenario.fmus.back();
                in_fmu_inputs = false;
                in_fmu_outputs = false;
                continue;
            }
            if (!current_fmu) continue;
            if (line == "inputs:") {
                in_fmu_inputs = true;
                in_fmu_outputs = false;
                continue;
            }
            if (line == "outputs:") {
                in_fmu_outputs = true;
                in_fmu_inputs = false;
                continue;
            }
            if (line.rfind("path:", 0) == 0) current_fmu->path = afterColon(line);
            else if (line.rfind("step_size:", 0) == 0) current_fmu->step_size = std::stod(afterColon(line));
            else if (line.rfind("- ", 0) == 0 && (in_fmu_inputs || in_fmu_outputs)) {
                const std::string binding = trim(line.substr(2));
                const auto colon = binding.find(':');
                if (colon == std::string::npos) continue;
                FmuPortBinding port;
                port.port = trim(binding.substr(0, colon));
                port.world_path = trim(binding.substr(colon + 1));
                if (in_fmu_inputs) current_fmu->inputs.push_back(port);
                else current_fmu->outputs.push_back(port);
            }
        }
    }

    if (!scenario.open_data.ais_tracks_path.empty()) {
        scenario.ais_tracks = loadAisTracksFromCsv(path.parent_path() / scenario.open_data.ais_tracks_path);
    }

    return scenario;
}

} // namespace darla
