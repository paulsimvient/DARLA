#include "sim-fmi/FmuBinding.h"

#include "Entity.h"

namespace darla {
namespace {

bool parseWorldPath(const std::string& world_path, std::string* entity_name, std::string* field) {
    const auto dot = world_path.find('.');
    if (dot == std::string::npos) return false;
    *entity_name = world_path.substr(0, dot);
    *field = world_path.substr(dot + 1);
    return true;
}

bool readField(const Entity& entity, const std::string& field, double* out) {
    if (field == "sensor.confidence" && entity.sensor) {
        *out = entity.sensor->confidence;
        return true;
    }
    if (field == "sensor.range_km" && entity.sensor) {
        *out = entity.sensor->range_km;
        return true;
    }
    if (field == "sensor.latency_sec" && entity.sensor) {
        *out = entity.sensor->latency_sec;
        return true;
    }
    if (field == "sensor.false_positive_rate" && entity.sensor) {
        *out = entity.sensor->false_positive_rate;
        return true;
    }
    if (field == "sensor.false_negative_rate" && entity.sensor) {
        *out = entity.sensor->false_negative_rate;
        return true;
    }
    if (field == "comms.packet_loss" && entity.comms) {
        *out = entity.comms->packet_loss;
        return true;
    }
    if (field == "comms.bandwidth_mbps" && entity.comms) {
        *out = entity.comms->bandwidth_mbps;
        return true;
    }
    if (field == "comms.latency_sec" && entity.comms) {
        *out = entity.comms->latency_sec;
        return true;
    }
    if (field == "cyber.integrity" && entity.cyber) {
        *out = entity.cyber->integrity;
        return true;
    }
    if (field == "cyber.compromise_probability" && entity.cyber) {
        *out = entity.cyber->compromise_probability;
        return true;
    }
    if (field == "cyber.lateral_movement_risk" && entity.cyber) {
        *out = entity.cyber->lateral_movement_risk;
        return true;
    }
    if (field == "kinematic.lat" && entity.kinematic) {
        *out = entity.kinematic->lat;
        return true;
    }
    if (field == "kinematic.lon" && entity.kinematic) {
        *out = entity.kinematic->lon;
        return true;
    }
    if (field == "kinematic.alt" && entity.kinematic) {
        *out = entity.kinematic->alt;
        return true;
    }
    if (field == "kinematic.heading_deg" && entity.kinematic) {
        *out = entity.kinematic->heading_deg;
        return true;
    }
    if (field == "kinematic.speed_mps" && entity.kinematic) {
        *out = entity.kinematic->speed_mps;
        return true;
    }
    if (field == "mission.progress" && entity.mission) {
        *out = entity.mission->progress;
        return true;
    }
    if (field == "mission.confidence" && entity.mission) {
        *out = entity.mission->confidence;
        return true;
    }
    if (field == "mission.mission_effectiveness" && entity.mission) {
        *out = entity.mission->mission_effectiveness;
        return true;
    }
    return false;
}

bool writeField(Entity& entity, const std::string& field, double value) {
    if (field == "sensor.confidence" && entity.sensor) {
        entity.sensor->confidence = value;
        return true;
    }
    if (field == "sensor.range_km" && entity.sensor) {
        entity.sensor->range_km = value;
        return true;
    }
    if (field == "sensor.latency_sec" && entity.sensor) {
        entity.sensor->latency_sec = value;
        return true;
    }
    if (field == "sensor.false_positive_rate" && entity.sensor) {
        entity.sensor->false_positive_rate = value;
        return true;
    }
    if (field == "sensor.false_negative_rate" && entity.sensor) {
        entity.sensor->false_negative_rate = value;
        return true;
    }
    if (field == "comms.packet_loss" && entity.comms) {
        entity.comms->packet_loss = value;
        return true;
    }
    if (field == "comms.bandwidth_mbps" && entity.comms) {
        entity.comms->bandwidth_mbps = value;
        return true;
    }
    if (field == "comms.latency_sec" && entity.comms) {
        entity.comms->latency_sec = value;
        return true;
    }
    if (field == "cyber.integrity" && entity.cyber) {
        entity.cyber->integrity = value;
        return true;
    }
    if (field == "cyber.compromise_probability" && entity.cyber) {
        entity.cyber->compromise_probability = value;
        return true;
    }
    if (field == "cyber.lateral_movement_risk" && entity.cyber) {
        entity.cyber->lateral_movement_risk = value;
        return true;
    }
    if (field == "kinematic.lat" && entity.kinematic) {
        entity.kinematic->lat = value;
        return true;
    }
    if (field == "kinematic.lon" && entity.kinematic) {
        entity.kinematic->lon = value;
        return true;
    }
    if (field == "kinematic.alt" && entity.kinematic) {
        entity.kinematic->alt = value;
        return true;
    }
    if (field == "kinematic.heading_deg" && entity.kinematic) {
        entity.kinematic->heading_deg = value;
        return true;
    }
    if (field == "kinematic.speed_mps" && entity.kinematic) {
        entity.kinematic->speed_mps = value;
        return true;
    }
    if (field == "mission.progress" && entity.mission) {
        entity.mission->progress = value;
        return true;
    }
    if (field == "mission.confidence" && entity.mission) {
        entity.mission->confidence = value;
        return true;
    }
    if (field == "mission.mission_effectiveness" && entity.mission) {
        entity.mission->mission_effectiveness = value;
        return true;
    }
    return false;
}

} // namespace

bool FmuBinding::readWorldValue(const WorldState& world, const std::string& world_path, double* out) {
    std::string entity_name;
    std::string field;
    if (!parseWorldPath(world_path, &entity_name, &field)) return false;

    const auto* entity = world.entityByName(entity_name);
    if (!entity) return false;

    return readField(*entity, field, out);
}

bool FmuBinding::writeWorldValue(WorldState& world, const std::string& world_path, double value) {
    std::string entity_name;
    std::string field;
    if (!parseWorldPath(world_path, &entity_name, &field)) return false;

    auto* entity = world.entityByName(entity_name);
    if (!entity) return false;

    return writeField(*entity, field, value);
}

} // namespace darla
