#include "sim-adjudication/MicroWorldAdjudicator.h"

#include "InterventionPreconditions.h"
#include "sim-agents/AgentRuntime.h"
#include "sim-adjudication/EmergenceDetector.h"
#include "sim-fmi/FmuMasterClock.h"

#include <algorithm>
#include <iomanip>
#include <sstream>

namespace darla {
namespace {

std::string fixed(double value) {
    std::ostringstream out;
    out << std::fixed << std::setprecision(2) << value;
    return out.str();
}

const SimEvent* lastEventOfType(const EventLedger& ledger, EventType type) {
    for (auto it = ledger.events().rbegin(); it != ledger.events().rend(); ++it) {
        if (it->type == type) return &*it;
    }
    return nullptr;
}

} // namespace

void MicroWorldAdjudicator::adjudicate(WorldState& world, EventLedger& ledger, TemporalCausalGraph& graph) const {
    FmuMasterClock::stepConfiguredFmus(world, ledger);
    maybeApplyScheduledInterventions(world, ledger);
    maybeRecordLogisticsDelay(world, ledger);
    if (world.realtime_agents_enabled && world.agent_runtime.relationships) {
        defaultAgentRuntime().preCyberStep(world, ledger, *world.agent_runtime.relationships);
    }
    maybeApplyCyberDegradation(world, ledger, graph);
    if (world.realtime_agents_enabled) {
        defaultAgentRuntime().postCyberStep(world, ledger, graph);
    }
    maybeRecordDetection(world, ledger, graph);
    maybeRecordCoaAndMission(world, ledger, graph);
    maybeRecordEmergence(world, ledger, graph);
}

void MicroWorldAdjudicator::maybeApplyScheduledInterventions(WorldState& world, EventLedger& ledger) const {
    for (auto& intervention : world.scheduled_interventions) {
        if (intervention.applied || intervention.at_tick != world.tick) continue;

        auto* target = world.entityByName(intervention.target);
        if (!target) continue;

        const auto application = applyInterventionEffect(world, intervention.type, *target);
        if (!application.scheduled) continue;

        intervention.applied = true;
        const double confidence = application.operational ? 0.80 : 0.40;
        const double epistemic = application.operational ? 0.10 : 0.20;
        ledger.append(SimEvent{
            0,
            world.tick,
            target->id,
            EventType::InterventionApplied,
            {target->id},
            application.deltas,
            {},
            {"intervention-engine-v0"},
            confidence,
            0.08,
            epistemic,
            application.operational ? "scheduled do-intervention branch" : "scheduled do-intervention branch",
            "maritime ISR cyber/comms scenario",
            application.audit_label});
    }
}

void MicroWorldAdjudicator::maybeRecordLogisticsDelay(WorldState& world, EventLedger& ledger) const {
    if (world.suppress_logistics_delay) return;
    if (world.logistics_delay_recorded || world.tick != 900) return;
    const auto* commander = world.entityByName("blue_commander");
    if (!commander) return;
    ledger.append(SimEvent{0, world.tick, commander->id, EventType::LogisticsDelay, {}, {{"logistics.delay", "false", "true"}}, {}, {"logistics-delay-v0"}, 0.72, 0.10, 0.18, "scripted confounder", "maritime ISR cyber/comms scenario", "logistics_delay_correlated_non_causal"});
    world.logistics_delay_recorded = true;
}

void MicroWorldAdjudicator::maybeApplyCyberDegradation(WorldState& world, EventLedger& ledger, TemporalCausalGraph& graph) const {
    if (world.cyber_degradation_applied) return;

    const ScriptedEvent* scripted = nullptr;
    if (world.pending_cyber_attack.pending) {
        for (const auto& event : world.scripted_events) {
            if (event.tick == world.tick && event.action == world.pending_cyber_attack.action) {
                scripted = &event;
                break;
            }
        }
    }
    if (!scripted) {
        for (const auto& event : world.scripted_events) {
            if (event.tick == world.tick && (event.action == "degrade_sensor_feed" || event.action == "degrade_comms_only")) {
                scripted = &event;
                break;
            }
        }
    }
    if (!scripted) return;

    auto* actor = world.entityByName(world.pending_cyber_attack.pending ? world.pending_cyber_attack.actor : scripted->actor);
    const std::string target_name = world.pending_cyber_attack.pending ? world.pending_cyber_attack.target : scripted->target;
    auto* uas = world.entityByName(target_name);
    auto* relay = world.entityByName("blue_relay_1");
    if (!actor) return;

    if (scripted->action == "degrade_comms_only") {
        if (!relay || !relay->comms) return;
        const double packet_loss_before = relay->comms->packet_loss;
        const double latency_before = relay->comms->latency_sec;
        relay->comms->packet_loss = 0.22;
        relay->comms->latency_sec = 6.0;
        relay->comms->compromised = true;

        const auto cyber_id = ledger.append(SimEvent{0, world.tick, actor->id, EventType::CyberDegrade, {relay->id}, {{"blue_relay_1.comms.packet_loss", fixed(packet_loss_before), fixed(relay->comms->packet_loss)}, {"blue_relay_1.comms.latency_sec", fixed(latency_before), fixed(relay->comms->latency_sec)}}, {}, {"cyber-effects-v0"}, 0.84, 0.08, 0.14, scripted->action, "maritime ISR cyber/comms scenario", "comms_degradation"});
        if (uas && uas->sensor) {
            const auto sensor_id = ledger.append(SimEvent{0, world.tick + 1, uas->id, EventType::Communicate, {relay->id}, {{"blue_uas_1.comms.status", "nominal", "degraded"}}, {cyber_id}, {"comms-effects-v0"}, 0.76, 0.10, 0.18, "comms-only cyber effect", "maritime ISR cyber/comms scenario", "comms_path_degraded"});
            const auto* cyber = ledger.find(cyber_id);
            const auto* sensor = ledger.find(sensor_id);
            if (cyber && sensor) graph.addEdge(*cyber, *sensor, CausalEdgeType::Degrades, 0.72, 0.76, "comms_degradation -> comms_path_degraded");
        }

        world.cyber_degradation_applied = true;
        world.comms_degradation_only = true;
        world.pending_cyber_attack.pending = false;
        return;
    }

    if (!uas || !uas->sensor) return;

    const double before = uas->sensor->confidence;
    const double after = std::max(0.0, before + scripted->sensor_confidence_delta);
    uas->sensor->confidence = after;
    uas->sensor->degraded = true;
    if (relay && relay->comms) {
        relay->comms->packet_loss = 0.22;
        relay->comms->latency_sec = 6.0;
        relay->comms->compromised = true;
    }

    const auto cyber_id = ledger.append(SimEvent{0, world.tick, actor->id, EventType::CyberDegrade, {uas->id}, {{"blue_uas_1.sensor.confidence", fixed(before), fixed(after)}}, {}, {"cyber-effects-v0"}, 0.86, 0.07, 0.14, "scripted red cyber action", "maritime ISR cyber/comms scenario", "red_cyber_degradation"});
    const auto sensor_id = ledger.append(SimEvent{0, world.tick + 1, uas->id, EventType::SensorConfidenceLoss, {uas->id}, {{"blue_uas_1.sensor.degraded", "false", "true"}}, {cyber_id}, {"sensor-confidence-v0"}, 0.81, 0.09, 0.17, "adjudicated from cyber effect", "maritime ISR cyber/comms scenario", "sensor_confidence_loss"});
    const auto* cyber = ledger.find(cyber_id);
    const auto* sensor = ledger.find(sensor_id);
    if (cyber && sensor) graph.addEdge(*cyber, *sensor, CausalEdgeType::Degrades, 0.78, 0.81, "red_cyber_degradation -> sensor_confidence_loss");

    world.cyber_degradation_applied = true;
    world.sensor_loss_recorded = true;
    world.pending_cyber_attack.pending = false;
}

void MicroWorldAdjudicator::maybeRecordDetection(WorldState& world, EventLedger& ledger, TemporalCausalGraph& graph) const {
    if (world.detection_recorded) return;
    const auto* uas = world.entityByName("blue_uas_1");
    const auto* target = world.entityByName("red_maritime_target");
    const auto* relay = world.entityByName("blue_relay_1");
    if (!uas || !target || !uas->sensor) return;

    const bool comms_blocking = world.comms_degradation_only && relay && relay->comms && relay->comms->compromised;
    const bool sensor_isolation_relevant = uas->sensor->isolated && world.sensor_loss_recorded;

    // Detection time is the structural equation D = f_D(degraded, isolated, autonomous,
    // comms_blocking; theta) + U_D. In the deterministic baseline U_D = 0 (structural
    // mean); Monte-Carlo replicates draw U_D from the SCM noise model.
    const StructuralCausalModel scm(world.scm);
    DetectionInputs detection_inputs;
    detection_inputs.degraded = uas->sensor->degraded;
    detection_inputs.isolated = sensor_isolation_relevant;
    detection_inputs.autonomous = world.autonomous_search_enabled;
    detection_inputs.comms_blocking = comms_blocking;
    const Tick detection_tick = world.scm_noise_enabled
        ? scm.detectionTick(detection_inputs, world.scm_noise_seed, /*detection stream*/ 1001)
        : scm.detectionTickMean(detection_inputs);
    if (!world.detection_delay_recorded && world.cyber_degradation_applied && !uas->sensor->isolated && world.tick == 1500) {
        std::vector<EventId> parents;
        if (const auto* sensor = lastEventOfType(ledger, EventType::SensorConfidenceLoss)) parents.push_back(sensor->event_id);
        const auto delay_id = ledger.append(SimEvent{0, world.tick, uas->id, EventType::Detect, {target->id}, {{"target_detection.status", "expected", "delayed"}}, parents, {"sensor-adjudication-v0"}, 0.74, 0.12, 0.22, "sensor confidence below targeting threshold", "maritime ISR cyber/comms scenario", "delayed_target_detection"});
        if (const auto* sensor = lastEventOfType(ledger, EventType::SensorConfidenceLoss)) {
            if (const auto* delay = ledger.find(delay_id)) graph.addEdge(*sensor, *delay, CausalEdgeType::Delays, 0.72, 0.74, "sensor_confidence_loss -> delayed_target_detection");
        }
        world.detection_delay_recorded = true;
        return;
    }

    if (world.tick < detection_tick) return;
    std::vector<EventId> parents;
    if (const auto* delay = lastEventOfType(ledger, EventType::Detect)) {
        if (delay->label == "delayed_target_detection") parents.push_back(delay->event_id);
    }
    if (const auto* intervention = lastEventOfType(ledger, EventType::InterventionApplied)) {
        parents.push_back(intervention->event_id);
    }
    ledger.append(SimEvent{0, world.tick, uas->id, EventType::Detect, {target->id}, {{"red_maritime_target.detected", "false", "true"}}, parents, {"sensor-adjudication-v0"}, uas->sensor->isolated ? 0.84 : 0.66, 0.10, uas->sensor->isolated ? 0.13 : 0.24, "target detection adjudicated", "maritime ISR cyber/comms scenario", uas->sensor->isolated ? "target_detected_after_intervention" : "late_target_detection"});
    world.metrics.target_detected = true;
    world.metrics.detection_time = world.tick;
    world.detection_recorded = true;
}

void MicroWorldAdjudicator::maybeRecordCoaAndMission(WorldState& world, EventLedger& ledger, TemporalCausalGraph& graph) const {
    if (!world.metrics.target_detected || world.mission_effect_recorded) return;
    const auto* commander = world.entityByName("blue_commander");
    const auto* target = world.entityByName("red_maritime_target");
    if (!commander || !target) return;
    const Tick coa_delay = world.engagement_pre_authorized ? 40 : 120;
    if (world.tick != world.metrics.detection_time + coa_delay) return;

    const bool success = world.metrics.detection_time <= world.mission.target_detected_before_tick;
    const auto* uas = world.entityByName("blue_uas_1");
    const bool sensor_isolated = uas && uas->sensor && uas->sensor->isolated;
    const bool high_confidence = uas && uas->sensor && uas->sensor->confidence >= world.mission.track_confidence_min;

    // Mission score is the structural equation M = f_M(success, autonomous, isolated,
    // preauthorized, high_confidence; theta) + U_M. Baseline uses the structural mean;
    // Monte-Carlo replicates draw U_M from the SCM noise model.
    const StructuralCausalModel scm(world.scm);
    MissionInputs mission_inputs;
    mission_inputs.success = success;
    mission_inputs.autonomous = world.autonomous_search_enabled;
    mission_inputs.isolated = sensor_isolated;
    mission_inputs.preauthorized = world.engagement_pre_authorized;
    mission_inputs.high_confidence = high_confidence;
    const double score = world.scm_noise_enabled
        ? scm.missionScore(mission_inputs, world.scm_noise_seed, /*mission stream*/ 2002)
        : scm.missionScoreMean(mission_inputs);
    std::vector<EventId> parents;
    if (const auto* detect = lastEventOfType(ledger, EventType::Detect)) parents.push_back(detect->event_id);
    const auto coa_id = ledger.append(SimEvent{0, world.tick, commander->id, EventType::DecideCOA, {target->id}, {{"coa.selection", "pending", success ? "timely" : "late"}}, parents, {"commander-policy-v0"}, success ? 0.76 : 0.64, 0.11, success ? 0.18 : 0.28, "rule-based commander policy", "maritime ISR cyber/comms scenario", success ? "timely_coa_selection" : "late_coa_selection"});
    if (const auto* detect = lastEventOfType(ledger, EventType::Detect)) {
        const auto* coa = ledger.find(coa_id);
        if (coa && (detect->label == "late_target_detection" || detect->label == "delayed_target_detection")) graph.addEdge(*detect, *coa, CausalEdgeType::Delays, 0.62, 0.64, "delayed_target_detection -> late_coa_selection");
    }
    const auto mission_id = ledger.append(SimEvent{0, world.tick, commander->id, EventType::MissionEffect, {target->id}, {{"mission.success_score", "0.00", fixed(score)}}, {coa_id}, {"mission-effects-v0"}, success ? 0.73 : 0.64, 0.12, success ? 0.19 : 0.31, "mission success conditions evaluated", "maritime ISR cyber/comms scenario", success ? "mission_recovery" : "mission_failure"});
    const auto* coa = ledger.find(coa_id);
    if (coa) {
        if (const auto* mission = ledger.find(mission_id)) graph.addEdge(*coa, *mission, CausalEdgeType::CausesMissionEffect, success ? 0.52 : 0.64, success ? 0.73 : 0.64, success ? "timely_coa_selection -> mission_recovery" : "late_coa_selection -> mission_failure");
    }
    world.metrics.coa_selection_time = world.tick;
    world.metrics.mission_success = success;
    world.metrics.mission_success_score = score;
    world.coa_recorded = true;
    world.mission_effect_recorded = true;
}

void MicroWorldAdjudicator::maybeRecordEmergence(WorldState& world, EventLedger& ledger, TemporalCausalGraph& graph) const {
    if (world.emergent_recorded || !world.mission_effect_recorded || world.metrics.mission_success) return;
    const auto* commander = world.entityByName("blue_commander");
    if (!commander) return;

    const EmergenceDetection detection = EmergenceDetector{}.evaluate(world, ledger);
    if (!detection.detected) return;

    std::vector<EventId> parents;
    if (const auto* mission = lastEventOfType(ledger, EventType::MissionEffect)) parents.push_back(mission->event_id);
    const std::string macro_behavior = detection.patterns.empty() ? "operational_tempo_collapse" : detection.patterns.front();
    const auto emergence_id = ledger.append(SimEvent{
        0,
        world.tick,
        commander->id,
        EventType::EmergentBehaviorDetected,
        {},
        {{"macro_behavior", "nominal", macro_behavior},
         {"decision_latency", "0", fixed(detection.metrics.decision_latency)},
         {"sensor_trust", "1.0", fixed(detection.metrics.sensor_trust)},
         {"comms_congestion", "0", fixed(detection.metrics.comms_congestion)},
         {"mission_tempo_ratio", "0", fixed(detection.metrics.mission_tempo_ratio)}},
        parents,
        {"emergence-detector-v1"},
        0.69,
        0.15,
        0.26,
        detection.summary,
        "maritime ISR cyber/comms scenario",
        macro_behavior});
    if (const auto* mission = lastEventOfType(ledger, EventType::MissionEffect)) {
        if (const auto* emergence = ledger.find(emergence_id)) graph.addEdge(*mission, *emergence, CausalEdgeType::CausesMissionEffect, 0.58, 0.69, "mission_failure -> " + macro_behavior);
    }
    world.metrics.emergent_tempo_collapse = true;
    world.emergent_recorded = true;
}

} // namespace darla
