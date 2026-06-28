#include "InterventionPreconditions.h"

#include "sim-events/SimEvent.h"

#include <iomanip>
#include <sstream>

namespace darla {
namespace {

std::string fixed(double value) {
    std::ostringstream out;
    out << std::fixed << std::setprecision(2) << value;
    return out.str();
}

} // namespace

bool sensorDegradationIsCausal(const WorldState& world, const Entity& entity) {
    return world.sensor_loss_recorded || (entity.sensor && entity.sensor->degraded);
}

bool commsDegradationIsCausal(const WorldState& world, const Entity& entity) {
    return world.comms_degradation_only || (entity.comms && entity.comms->compromised);
}

InterventionPrecondition evaluateInterventionPrecondition(
    const WorldState& world,
    const std::string& intervention_type,
    const Entity* target) {
    InterventionPrecondition result;

    if (intervention_type == "isolate_compromised_sensor_feed") {
        if (!target || !target->sensor) {
            result.reason = "target has no sensor component";
            result.audit_label = "do(isolate_compromised_sensor_feed) invalid target";
            return result;
        }
        if (!sensorDegradationIsCausal(world, *target)) {
            result.reason = "sensor path healthy — isolation not causally relevant";
            result.audit_label = "do(isolate_compromised_sensor_feed) no operational effect - sensor healthy";
            return result;
        }
        result.applies = true;
        result.audit_label = "do(isolate_compromised_sensor_feed)";
        return result;
    }

    if (intervention_type == "restore_comms_relay") {
        if (!target || !target->comms) {
            result.reason = "target has no comms component";
            result.audit_label = "do(restore_comms_relay) invalid target";
            return result;
        }
        if (!commsDegradationIsCausal(world, *target)) {
            result.reason = "comms path healthy — restore not causally relevant";
            result.audit_label = "do(restore_comms_relay) no operational effect - comms healthy";
            return result;
        }
        result.applies = true;
        result.audit_label = "do(restore_comms_relay)";
        return result;
    }

    if (intervention_type == "remove_logistics_delay") {
        if (world.suppress_logistics_delay) {
            result.reason = "logistics delay already suppressed";
            result.audit_label = "do(remove_logistics_delay) no operational effect - already suppressed";
            return result;
        }
        result.applies = true;
        result.audit_label = "do(remove_logistics_delay)";
        result.reason = "suppresses logistics confounder branch";
        return result;
    }

    if (intervention_type == "enable_autonomous_search") {
        const auto* uas = world.entityByName("blue_uas_1");
        if (!uas || !uas->sensor || !sensorDegradationIsCausal(world, *uas)) {
            result.reason = "autonomous search requires degraded sensor path";
            result.audit_label = "do(enable_autonomous_search) no operational effect - sensor path healthy";
            return result;
        }
        result.applies = true;
        result.audit_label = "do(enable_autonomous_search)";
        return result;
    }

    if (intervention_type == "pre_authorize_engagement") {
        if (!world.metrics.target_detected) {
            result.reason = "pre-authorization requires completed detection";
            result.audit_label = "do(pre_authorize_engagement) no operational effect - detection incomplete";
            return result;
        }
        result.applies = true;
        result.audit_label = "do(pre_authorize_engagement)";
        return result;
    }

    result.reason = "unknown intervention type";
    result.audit_label = intervention_type + " unsupported";
    return result;
}

InterventionApplicationResult applyInterventionEffect(
    WorldState& world,
    const std::string& intervention_type,
    Entity& target) {
    InterventionApplicationResult result;
    const auto precondition = evaluateInterventionPrecondition(world, intervention_type, &target);
    result.audit_label = precondition.audit_label;
    result.scheduled = true;

    if (!precondition.applies) {
        if (intervention_type == "isolate_compromised_sensor_feed" && target.sensor) {
            result.deltas.push_back({"blue_uas_1.sensor.isolated", "false", "false"});
        } else if (intervention_type == "restore_comms_relay" && target.comms) {
            result.deltas.push_back({"blue_relay_1.comms.compromised", "false", "false"});
        } else if (intervention_type == "enable_autonomous_search") {
            result.deltas.push_back({"blue_uas_1.autonomy_mode", "manual_search", "manual_search"});
        } else if (intervention_type == "pre_authorize_engagement") {
            result.deltas.push_back({"engagement_authority", "normal", "normal"});
        }
        return result;
    }

    result.operational = true;
    world.intervention_applied = true;

    if (intervention_type == "isolate_compromised_sensor_feed" && target.sensor) {
        const double before = target.sensor->confidence;
        target.sensor->isolated = true;
        target.sensor->degraded = false;
        target.sensor->confidence = std::max(target.sensor->confidence, 0.74);
        result.deltas.push_back({"blue_uas_1.sensor.confidence", fixed(before), fixed(target.sensor->confidence)});
        result.deltas.push_back({"blue_uas_1.sensor.isolated", "false", "true"});
    } else if (intervention_type == "restore_comms_relay" && target.comms) {
        const double packet_loss_before = target.comms->packet_loss;
        const double latency_before = target.comms->latency_sec;
        target.comms->packet_loss = 0.01;
        target.comms->latency_sec = 1.0;
        target.comms->compromised = false;
        result.deltas.push_back({"blue_relay_1.comms.packet_loss", fixed(packet_loss_before), fixed(target.comms->packet_loss)});
        result.deltas.push_back({"blue_relay_1.comms.latency_sec", fixed(latency_before), fixed(target.comms->latency_sec)});
    } else if (intervention_type == "remove_logistics_delay") {
        world.suppress_logistics_delay = true;
        result.deltas.push_back({"logistics.delay", "possible", "suppressed"});
    } else if (intervention_type == "enable_autonomous_search") {
        world.autonomous_search_enabled = true;
        result.deltas.push_back({"blue_uas_1.autonomy_mode", "manual_search", "autonomous_search"});
    } else if (intervention_type == "pre_authorize_engagement") {
        world.engagement_pre_authorized = true;
        result.deltas.push_back({"engagement_authority", "normal", "pre_authorized"});
    }

    return result;
}

} // namespace darla
