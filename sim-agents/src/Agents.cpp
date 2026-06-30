#include "sim-agents/Agents.h"
#include "sim-agents/AuthorityGate.h"

#include "ExecutionBudget.h"
#include "Snapshot.h"
#include "SimRealism.h"
#include "sim-graph/GraphEntityResolver.h"

#include <algorithm>
#include <cmath>
#include <sstream>

namespace darla {
namespace {

const SimEvent* lastEventWithLabel(const EventLedger& ledger, const std::string& label) {
    for (auto it = ledger.events().rbegin(); it != ledger.events().rend(); ++it) {
        if (it->label == label) return &*it;
    }
    return nullptr;
}

std::string fixed(double value) {
    std::ostringstream out;
    out << std::fixed << value;
    return out.str();
}

std::string scoreText(double value) {
    std::ostringstream out;
    out.precision(3);
    out << std::fixed << value;
    return out.str();
}

EntityId entityIdFor(const WorldState& world, const std::string& name) {
    const auto* entity = world.entityByName(name);
    return entity ? entity->id : 0;
}

Tick scheduleTickFor(ActionType action, Tick current_tick) {
    switch (action) {
    case ActionType::IsolateCompromisedSensorFeed:
    case ActionType::RestoreCommsRelay:
        return std::max<Tick>(760, current_tick + 1);
    case ActionType::EnableAutonomousSearch:
    case ActionType::PreAuthorizeEngagement:
        return std::max<Tick>(900, current_tick + 1);
    case ActionType::HoldCurrentCOA:
        return current_tick;
    }
    return current_tick + 1;
}

std::string targetNameFor(ActionType action) {
    switch (action) {
    case ActionType::IsolateCompromisedSensorFeed:
    case ActionType::EnableAutonomousSearch:
        return "blue_uas_1";
    case ActionType::RestoreCommsRelay:
        return "blue_relay_1";
    case ActionType::PreAuthorizeEngagement:
        return "blue_commander";
    case ActionType::HoldCurrentCOA:
        return {};
    }
    return {};
}

bool shouldEmitMonitoring(Tick tick, Tick last_emit, Tick interval) {
    return tick == 0 || tick - last_emit >= interval;
}

double missionTempoRatio(const WorldState& world) {
    if (world.mission.target_detected_before_tick == 0) return 0.0;
    if (world.metrics.detection_time > 0) {
        return static_cast<double>(world.metrics.detection_time) / static_cast<double>(world.mission.target_detected_before_tick);
    }
    if (world.tick == 0) return 0.0;
    return static_cast<double>(world.tick) / static_cast<double>(world.mission.target_detected_before_tick);
}

double missionRiskScore(const WorldState& world) {
    const double tempo = missionTempoRatio(world);
    const double trust_penalty = 1.0 - world.agent_beliefs.sensor.trust;
    const double comms_penalty = world.agent_beliefs.comms.operationally_relevant ? 0.25 : 0.0;
    return std::min(1.0, (tempo * 0.45) + (trust_penalty * 0.40) + comms_penalty);
}

void appendCandidateFromGraph(
    AgentDecision& decision,
    WorldState& world,
    EventLedger& ledger,
    const Snapshot& branch_snapshot,
    const ActionEffectEstimator& estimator_base,
    const MissionMetrics& baseline,
    ActionType action,
    EntityId actor,
    const std::vector<EntityId>& targets,
    double urgency) {
    const Tick at_tick = scheduleTickFor(action, world.tick);
    ActionEffectEstimate estimate;
    if (!tryConsumeCausalQuery(world, ledger, "BlueCommanderAgent")) {
        estimate.supported = false;
        estimate.rationale = "causal query budget exceeded";
        estimate.uncertainty_penalty = 1.0;
    } else {
        estimate = estimator_base.estimate(
            branch_snapshot,
            baseline,
            action,
            actor,
            targets,
            at_tick,
            world.agent_runtime.horizon_ticks);
    }

    CandidateAction candidate;
    candidate.type = action;
    candidate.actor = actor;
    candidate.targets = targets;
    candidate.expectedMissionGain = estimate.expected_mission_gain;
    candidate.causalConfidence = estimate.causal_confidence;
    candidate.timeUrgency = urgency;
    candidate.cost = estimate.cost;
    candidate.risk = estimate.risk;
    candidate.uncertaintyPenalty = estimate.uncertainty_penalty;
    candidate.supported = estimate.supported;
    candidate.causal_path = estimate.causal_path;
    candidate.structuredRationale = estimate.rationale;
    decision.candidates.push_back(candidate);
}

CandidateAction selectBestSupported(AgentDecision& decision) {
    const auto best_supported = std::max_element(
        decision.candidates.begin(),
        decision.candidates.end(),
        [](const CandidateAction& lhs, const CandidateAction& rhs) {
            if (lhs.type == ActionType::HoldCurrentCOA) return true;
            if (rhs.type == ActionType::HoldCurrentCOA) return false;
            if (lhs.supported != rhs.supported) return !lhs.supported;
            return (lhs.expectedMissionGain * lhs.causalConfidence) < (rhs.expectedMissionGain * rhs.causalConfidence);
        });

    if (best_supported != decision.candidates.end() &&
        best_supported->type != ActionType::HoldCurrentCOA &&
        best_supported->supported &&
        best_supported->expectedMissionGain > 0.05) {
        return *best_supported;
    }

    const auto hold = std::find_if(
        decision.candidates.begin(),
        decision.candidates.end(),
        [](const CandidateAction& candidate) { return candidate.type == ActionType::HoldCurrentCOA; });
    if (hold != decision.candidates.end()) {
        CandidateAction selected = *hold;
        selected.structuredRationale = "causal runtime refused unsupported actions; holding current COA";
        return selected;
    }
    return decision.candidates.front();
}

} // namespace

double CandidateAction::score() const {
    if (!supported) return -1.0;
    return (expectedMissionGain * causalConfidence * timeUrgency) - risk - cost - uncertaintyPenalty;
}

void RedCyberAgent::step(WorldState& world, EventLedger& ledger, const RelationshipGraph& graph) const {
    if (!world.realtime_agents_enabled) return;

    auto& belief = world.agent_beliefs.red_cyber;
    const auto* uas = world.entityByName("blue_uas_1");
    const auto* relay = world.entityByName("blue_relay_1");
    belief.blue_posture_score = (uas && uas->sensor ? uas->sensor->confidence : 0.88) *
        (relay && relay->comms ? (1.0 - relay->comms->packet_loss) : 1.0);
    belief.attack_opportunity = std::max(0.0, 1.0 - belief.blue_posture_score);
    belief.last_sense_tick = world.tick;

    if (shouldEmitMonitoring(world.tick, belief.last_monitoring_tick, kAgentMonitoringInterval)) {
        ledger.append(SimEvent{
            0,
            world.tick,
            entityIdFor(world, "red_cyber_actor"),
            EventType::Observe,
            {entityIdFor(world, "blue_uas_1")},
            {{"red_cyber.blue_posture", "unknown", fixed(belief.blue_posture_score)}, {"red_cyber.attack_opportunity", "unknown", fixed(belief.attack_opportunity)}, {"red_cyber.policy", "unknown", toString(world.realism.red_adversary.mode)}, {"red_cyber.target_score.uas", "unknown", fixed(world.realism_runtime.red_target_score_uas)}, {"red_cyber.target_score.relay", "unknown", fixed(world.realism_runtime.red_target_score_relay)}},
            {},
            {"red-cyber-agent-v0"},
            0.72,
            0.10,
            0.12,
            "continuous Blue posture monitoring",
            "maritime ISR cyber/comms scenario",
            "red_cyber_monitoring"});
        belief.last_monitoring_tick = world.tick;
    }

    if (belief.attack_committed || world.cyber_degradation_applied) return;

    const ScriptedEvent* scripted = nullptr;
    for (const auto& event : world.scripted_events) {
        if (event.tick == world.tick && (event.action == "degrade_sensor_feed" || event.action == "degrade_comms_only")) {
            scripted = &event;
            break;
        }
    }
    if (!scripted) {
        if (world.realism.red_adversary.mode == RedPolicyMode::AdaptiveOpportunistic && world.tick >= world.realism.red_adversary.mean_dwell_ticks) {
            const auto* actor = world.entityByName("red_cyber_actor");
            if (!actor) return;
            const bool prefer_relay = world.realism_runtime.red_target_score_relay > world.realism_runtime.red_target_score_uas + 0.05;
            const std::string target = prefer_relay ? "blue_relay_1" : "blue_uas_1";
            const std::string action = prefer_relay ? "degrade_comms_only" : "degrade_sensor_feed";
            ledger.append(SimEvent{
                0,
                world.tick,
                actor->id,
                EventType::PolicyChangeProposed,
                {entityIdFor(world, target)},
                {{"red_cyber.action", "idle", action}, {"red_cyber.target", "none", target}, {"red_cyber.decision_basis", "none", world.realism_runtime.last_red_decision_summary}},
                {},
                {"red-cyber-agent-v1"},
                0.78,
                0.12,
                0.18,
                "adaptive adversary policy selected target from mission-effect/stealth score",
                "synthetic calibrated red policy",
                "red_cyber_adaptive_decision"});
            world.pending_cyber_attack = PendingCyberAttack{
                true,
                "red_cyber_actor",
                target,
                action,
                prefer_relay ? 0.0 : world.scm.sensor_beta_cyber,
                prefer_relay ? -0.25 : -0.18};
            belief.attack_committed = true;
        }
        return;
    }

    const auto* actor = world.entityByName(scripted->actor);
    if (!actor) return;

    std::string target = scripted->target;
    for (const auto& edge : graph.edgesFrom(scripted->actor, RelationshipType::Degrades)) {
        target = edge.target;
        break;
    }

    ledger.append(SimEvent{
        0,
        world.tick,
        actor->id,
        EventType::PolicyChangeProposed,
        {entityIdFor(world, target)},
        {{"red_cyber.action", "idle", scripted->action}, {"red_cyber.target", "none", target}, {"red_cyber.decision_basis", "none", world.realism_runtime.last_red_decision_summary}},
        {},
        {"red-cyber-agent-v0"},
        0.84,
        0.08,
        0.12,
        "relationship graph selected degrade target",
        "maritime ISR cyber/comms scenario",
        "red_cyber_agent_decision"});

    world.pending_cyber_attack = PendingCyberAttack{
        true,
        scripted->actor,
        target,
        scripted->action,
        scripted->sensor_confidence_delta,
        scripted->network_integrity_delta};
    belief.attack_committed = true;
}

void SensorAgent::step(WorldState& world, EventLedger& ledger) const {
    if (!world.realtime_agents_enabled) return;
    const auto* uas = world.entityByName("blue_uas_1");
    if (!uas || !uas->sensor) return;

    auto& belief = world.agent_beliefs.sensor;
    const double previous_trust = belief.trust;
    belief.trust = uas->sensor->confidence;
    belief.degraded = uas->sensor->degraded;
    belief.isolated = uas->sensor->isolated;
    belief.last_sense_tick = world.tick;

    const bool trust_collapsed = belief.trust < 0.55;
    const bool material_drop = world.cyber_degradation_applied && (previous_trust - belief.trust) > 0.20;
    if ((trust_collapsed || material_drop) && !belief.anomaly_active) {
        belief.anomaly_active = true;
        std::vector<EventId> parents;
        if (const auto* cyber = lastEventWithLabel(ledger, "red_cyber_degradation")) {
            parents.push_back(cyber->event_id);
        } else if (const auto* sensor_loss = lastEventWithLabel(ledger, "sensor_confidence_loss")) {
            parents.push_back(sensor_loss->event_id);
        }
        ledger.append(SimEvent{
            0,
            world.tick,
            uas->id,
            EventType::Observe,
            {uas->id},
            {{"blue_uas_1.sensor.trust", fixed(previous_trust), fixed(belief.trust)}, {"blue_uas_1.sensor.anomaly", "false", "true"}},
            parents,
            {"sensor-agent-v0"},
            0.82,
            0.09,
            0.14,
            "sensor trust anomaly detected",
            "maritime ISR cyber/comms scenario",
            "sensor_agent_anomaly"});
    }

    if (shouldEmitMonitoring(world.tick, belief.last_monitoring_tick, kAgentMonitoringInterval)) {
        ledger.append(SimEvent{
            0,
            world.tick,
            uas->id,
            EventType::Observe,
            {uas->id},
            {{"blue_uas_1.sensor.confidence", "unknown", fixed(belief.trust)}, {"blue_uas_1.sensor.degraded", "unknown", belief.degraded ? "true" : "false"}},
            {},
            {"sensor-agent-v0"},
            0.76,
            0.09,
            0.12,
            "continuous sensor feed monitoring",
            "maritime ISR cyber/comms scenario",
            "sensor_agent_monitoring"});
        belief.last_monitoring_tick = world.tick;
    }

    if (world.cyber_degradation_applied && !belief.initial_observation_emitted) {
        std::vector<EventId> parents;
        if (const auto* sensor_loss = lastEventWithLabel(ledger, "sensor_confidence_loss")) {
            parents.push_back(sensor_loss->event_id);
        } else if (world.comms_degradation_only) {
            if (const auto* comms_obs = lastEventWithLabel(ledger, "comms_agent_observation")) {
                parents.push_back(comms_obs->event_id);
            }
        }
        ledger.append(SimEvent{
            0,
            world.tick,
            uas->id,
            EventType::Observe,
            {uas->id},
            {{"blue_uas_1.sensor.confidence", "unknown", fixed(belief.trust)}, {"blue_uas_1.sensor.degraded", "unknown", belief.degraded ? "true" : "false"}},
            parents,
            {"sensor-agent-v0"},
            0.80,
            0.09,
            0.14,
            "local sensor feed observation",
            "maritime ISR cyber/comms scenario",
            "sensor_agent_observation"});
        belief.initial_observation_emitted = true;
    }
}

void CommsAgent::step(WorldState& world, EventLedger& ledger) const {
    if (!world.realtime_agents_enabled) return;
    const auto* relay = world.entityByName("blue_relay_1");
    if (!relay || !relay->comms) return;

    auto& belief = world.agent_beliefs.comms;
    belief.latency_sec = relay->comms->latency_sec;
    belief.packet_loss = relay->comms->packet_loss;
    belief.health = std::max(0.0, 1.0 - belief.packet_loss - (belief.latency_sec / 20.0));
    belief.operationally_relevant = relay->comms->compromised || belief.latency_sec > 2.0 || belief.packet_loss > 0.05;
    belief.last_sense_tick = world.tick;

    if (belief.operationally_relevant && !belief.anomaly_active) {
        belief.anomaly_active = true;
        std::vector<EventId> parents;
        if (const auto* cyber = lastEventWithLabel(ledger, "red_cyber_degradation")) {
            parents.push_back(cyber->event_id);
        } else if (const auto* comms_cyber = lastEventWithLabel(ledger, "comms_degradation")) {
            parents.push_back(comms_cyber->event_id);
        }
        ledger.append(SimEvent{
            0,
            world.tick,
            relay->id,
            EventType::Communicate,
            {entityIdFor(world, "blue_commander"), entityIdFor(world, "blue_uas_1")},
            {{"blue_relay_1.comms.health", "nominal", fixed(belief.health)}, {"blue_relay_1.comms.anomaly", "false", "true"}},
            parents,
            {"comms-agent-v0"},
            0.80,
            0.10,
            0.16,
            "comms degradation operationally relevant",
            "maritime ISR cyber/comms scenario",
            "comms_agent_anomaly"});
    }

    if (shouldEmitMonitoring(world.tick, belief.last_monitoring_tick, kAgentMonitoringInterval)) {
        ledger.append(SimEvent{
            0,
            world.tick,
            relay->id,
            EventType::Communicate,
            {entityIdFor(world, "blue_commander"), entityIdFor(world, "blue_uas_1")},
            {{"blue_relay_1.comms.packet_loss", "unknown", fixed(belief.packet_loss)}, {"blue_relay_1.comms.latency_sec", "unknown", fixed(belief.latency_sec)}},
            {},
            {"comms-agent-v0"},
            0.74,
            0.10,
            0.14,
            "continuous relay health monitoring",
            "maritime ISR cyber/comms scenario",
            "comms_agent_monitoring"});
        belief.last_monitoring_tick = world.tick;
    }

    if (world.cyber_degradation_applied && !belief.initial_observation_emitted) {
        std::vector<EventId> parents;
        if (const auto* cyber = lastEventWithLabel(ledger, "red_cyber_degradation")) {
            parents.push_back(cyber->event_id);
        } else if (const auto* comms_cyber = lastEventWithLabel(ledger, "comms_degradation")) {
            parents.push_back(comms_cyber->event_id);
        }
        ledger.append(SimEvent{
            0,
            world.tick,
            relay->id,
            EventType::Communicate,
            {entityIdFor(world, "blue_commander"), entityIdFor(world, "blue_uas_1")},
            {{"blue_relay_1.comms.packet_loss", "unknown", fixed(belief.packet_loss)}, {"blue_relay_1.comms.latency_sec", "unknown", fixed(belief.latency_sec)}},
            parents,
            {"comms-agent-v0"},
            0.78,
            0.10,
            0.16,
            "relay health observation",
            "maritime ISR cyber/comms scenario",
            "comms_agent_observation"});
        belief.initial_observation_emitted = true;
    }
}

void BlueUASAgent::step(WorldState& world, EventLedger& ledger) const {
    if (!world.realtime_agents_enabled) return;
    const auto* uas = world.entityByName("blue_uas_1");
    const auto* target = world.entityByName("red_maritime_target");
    if (!uas || !target) return;

    auto& belief = world.agent_beliefs.uas;
    belief.autonomy_mode = world.autonomous_search_enabled ? "autonomous_search" : "manual_search";
    belief.search_status = (uas->sensor && uas->sensor->degraded) ? "degraded_feed" : "nominal";
    belief.detection_progress = world.metrics.target_detected ? 1.0 : (world.cyber_degradation_applied ? 0.35 : 0.0);
    belief.last_sense_tick = world.tick;

    if (world.cyber_degradation_applied && belief.search_status == "degraded_feed" && !belief.anomaly_active) {
        belief.anomaly_active = true;
        ledger.append(SimEvent{
            0,
            world.tick,
            uas->id,
            EventType::Observe,
            {target->id},
            {{"blue_uas_1.search_status", "nominal", belief.search_status}, {"blue_uas_1.detection_progress", "unknown", fixed(belief.detection_progress)}},
            {},
            {"blue-uas-agent-v0"},
            0.74,
            0.11,
            0.15,
            "search posture degraded",
            "maritime ISR cyber/comms scenario",
            "blue_uas_agent_anomaly"});
    }

    if (shouldEmitMonitoring(world.tick, belief.last_monitoring_tick, kAgentMonitoringInterval)) {
        ledger.append(SimEvent{
            0,
            world.tick,
            uas->id,
            EventType::Observe,
            {target->id},
            {{"blue_uas_1.autonomy_mode", "unknown", belief.autonomy_mode}, {"blue_uas_1.search_status", "unknown", belief.search_status}},
            {},
            {"blue-uas-agent-v0"},
            0.72,
            0.11,
            0.13,
            "continuous platform search monitoring",
            "maritime ISR cyber/comms scenario",
            "blue_uas_agent_monitoring"});
        belief.last_monitoring_tick = world.tick;
    }

    if (world.cyber_degradation_applied && !belief.initial_observation_emitted) {
        std::vector<EventId> parents;
        if (const auto* sensor_obs = lastEventWithLabel(ledger, "sensor_agent_observation")) {
            parents.push_back(sensor_obs->event_id);
        }
        ledger.append(SimEvent{
            0,
            world.tick,
            uas->id,
            EventType::Observe,
            {target->id},
            {{"blue_uas_1.autonomy_mode", "unknown", belief.autonomy_mode}, {"blue_uas_1.search_status", "active", belief.search_status}},
            parents,
            {"blue-uas-agent-v0"},
            0.76,
            0.11,
            0.15,
            "platform search posture observation",
            "maritime ISR cyber/comms scenario",
            "blue_uas_agent_observation"});
        belief.initial_observation_emitted = true;
    }
}

void LogisticsAgent::step(WorldState& world, EventLedger& ledger) const {
    if (!world.realtime_agents_enabled) return;
    const auto* logistics = world.entityByName("logistics_support_node");
    const auto* commander = world.entityByName("blue_commander");
    if (!logistics || !commander) return;

    auto& belief = world.agent_beliefs.logistics;
    belief.supply_status = world.suppress_logistics_delay ? "suppressed_delay" : (world.logistics_delay_recorded ? "delayed" : "nominal");
    belief.correlated_delay = world.logistics_delay_recorded;
    belief.last_sense_tick = world.tick;

    if (shouldEmitMonitoring(world.tick, belief.last_monitoring_tick, kAgentMonitoringInterval) && world.tick >= 120) {
        ledger.append(SimEvent{
            0,
            world.tick,
            logistics->id,
            EventType::Resupply,
            {commander->id},
            {{"logistics.supply_status", "unknown", belief.supply_status}},
            {},
            {"logistics-agent-v0"},
            0.68,
            0.12,
            0.16,
            "continuous supply chain monitoring",
            "maritime ISR cyber/comms scenario",
            "logistics_agent_monitoring"});
        belief.last_monitoring_tick = world.tick;
    }

    const bool should_observe = (world.logistics_delay_recorded || world.tick >= 900) && !belief.initial_observation_emitted;
    if (should_observe && world.cyber_degradation_applied) {
        ledger.append(SimEvent{
            0,
            world.tick,
            logistics->id,
            EventType::Resupply,
            {commander->id},
            {{"logistics.supply_status", "nominal", belief.supply_status}},
            {},
            {"logistics-agent-v0"},
            0.70,
            0.12,
            0.18,
            "supply chain observation; correlated but non-causal",
            "maritime ISR cyber/comms scenario",
            "logistics_agent_observation"});
        belief.initial_observation_emitted = true;
    }
}

void CausalMonitorAgent::step(WorldState& world, EventLedger& ledger) const {
    if (!world.realtime_agents_enabled) return;
    if (world.tick % kCausalScanInterval != 0 && world.tick != 720) return;

    auto& belief = world.agent_beliefs.causal_monitor;
    belief.sensor_trust = world.agent_beliefs.sensor.trust;
    belief.comms_congestion = world.agent_beliefs.comms.packet_loss + (world.agent_beliefs.comms.latency_sec / 20.0);
    belief.mission_tempo_ratio = missionTempoRatio(world);
    belief.active_patterns.clear();

    if (world.cyber_degradation_applied && belief.sensor_trust < 0.55) {
        belief.active_patterns.push_back("sensor_trust_collapse");
    }
    if (belief.comms_congestion > 0.25) {
        belief.active_patterns.push_back("comms_cascade");
    }
    if (belief.mission_tempo_ratio > 1.0) {
        belief.active_patterns.push_back("mission_tempo_degradation");
    }
    if (world.cyber_degradation_applied && !world.metrics.target_detected && world.tick > world.mission.target_detected_before_tick / 2) {
        belief.active_patterns.push_back("delayed_detection_risk");
    }
    belief.emergence_warning = !belief.active_patterns.empty();
    belief.last_scan_tick = world.tick;

    const std::string label = belief.emergence_warning ? "causal_monitor_warning" : "causal_monitor_monitoring";
    std::ostringstream patterns;
    for (std::size_t i = 0; i < belief.active_patterns.size(); ++i) {
        if (i > 0) patterns << ",";
        patterns << belief.active_patterns[i];
    }

    ledger.append(SimEvent{
        0,
        world.tick,
        entityIdFor(world, "blue_commander"),
        EventType::Observe,
        {},
        {{"causal.patterns", "none", patterns.str()}, {"causal.mission_tempo_ratio", "unknown", fixed(belief.mission_tempo_ratio)}},
        {},
        {"causal-monitor-v0"},
        belief.emergence_warning ? 0.78 : 0.62,
        0.10,
        0.14,
        belief.emergence_warning ? "emerging causal chain detected" : "continuous causal path monitoring",
        "maritime ISR cyber/comms scenario",
        label});
}

void CredibilityAgent::step(WorldState& world, EventLedger& ledger) const {
    if (!world.realtime_agents_enabled) return;
    if (world.tick % kCausalScanInterval != 0 && world.tick != 720) return;

    auto& belief = world.agent_beliefs.credibility;
    belief.validity_ok = true;
    belief.envelope_status = "inside";
    belief.last_violation.clear();

    if (world.cyber_degradation_applied && world.agent_beliefs.sensor.trust < 0.40) {
        belief.validity_ok = false;
        belief.envelope_status = "outside";
        belief.last_violation = "sensor trust below cyber-effect model valid envelope";
    } else if (world.agent_beliefs.comms.operationally_relevant && world.comms_degradation_only && world.agent_beliefs.sensor.trust >= world.mission.track_confidence_min) {
        belief.envelope_status = "marginal";
        belief.last_violation = "comms-only degradation; sensor model remains valid";
    }

    const std::string label = belief.validity_ok ? "credibility_monitoring" : "credibility_violation";
    ledger.append(SimEvent{
        0,
        world.tick,
        entityIdFor(world, "blue_cyber_defense"),
        EventType::Observe,
        {},
        {{"credibility.envelope", "unknown", belief.envelope_status}, {"credibility.valid", "unknown", belief.validity_ok ? "true" : "false"}},
        {},
        {"credibility-agent-v0"},
        belief.validity_ok ? 0.70 : 0.58,
        0.11,
        0.15,
        belief.last_violation.empty() ? "validity envelope monitoring" : belief.last_violation,
        "maritime ISR cyber/comms scenario",
        label});
    belief.last_check_tick = world.tick;
}

AgentDecision BlueCommanderAgent::decide(
    WorldState& world,
    EventLedger& ledger,
    const Snapshot& branch_snapshot,
    const RelationshipGraph& graph,
    const ActionEffectEstimator& estimator) const {
    const auto* commander = world.entityByName("blue_commander");
    const auto commanded_uas = firstGraphTarget(world, graph, "blue_commander", RelationshipType::Commands);
    const auto comms_target = firstGraphTarget(world, graph, "blue_commander", RelationshipType::CommunicatesWith);
    const auto* uas = commanded_uas ? world.entityByName(*commanded_uas) : world.entityByName("blue_uas_1");
    const auto* relay = comms_target ? world.entityByName(*comms_target) : world.entityByName("blue_relay_1");
    AgentDecision decision;
    decision.tick = world.tick;
    decision.agent = "BlueCommanderAgent";
    if (!commander || !world.agent_runtime.horizon_ticks) {
        return decision;
    }

    const double urgency = world.tick < world.mission.target_detected_before_tick ? 1.0 : 0.2;
    const MissionMetrics projected_baseline = estimator.projectBaseline(branch_snapshot, world.agent_runtime.horizon_ticks);

    const bool sensor_degraded = uas && uas->sensor && uas->sensor->degraded;
    const bool sensor_healthy = uas && uas->sensor && !uas->sensor->degraded && uas->sensor->confidence >= world.mission.track_confidence_min;
    const bool comms_degraded = relay && relay->comms && relay->comms->compromised;
    const bool high_confidence = uas && uas->sensor && uas->sensor->confidence >= world.mission.track_confidence_min;
    const bool detection_complete = world.metrics.target_detected;

    if (sensor_degraded) {
        for (const auto& edge : graph.edgesFrom("blue_commander", RelationshipType::Commands)) {
            const EntityId target_id = entityIdFor(world, edge.target);
            if (target_id == 0) continue;
            appendCandidateFromGraph(decision, world, ledger, branch_snapshot, estimator, projected_baseline, ActionType::IsolateCompromisedSensorFeed, commander->id, {target_id}, urgency);
            appendCandidateFromGraph(decision, world, ledger, branch_snapshot, estimator, projected_baseline, ActionType::EnableAutonomousSearch, commander->id, {target_id}, urgency);
        }
    }

    if (comms_degraded && sensor_healthy) {
        for (const auto& edge : graph.edgesFrom("blue_commander", RelationshipType::CommunicatesWith)) {
            const EntityId target_id = entityIdFor(world, edge.target);
            if (target_id == 0) continue;
            appendCandidateFromGraph(decision, world, ledger, branch_snapshot, estimator, projected_baseline, ActionType::RestoreCommsRelay, commander->id, {target_id}, urgency);
        }
    }

    if (detection_complete && high_confidence) {
        appendCandidateFromGraph(decision, world, ledger, branch_snapshot, estimator, projected_baseline, ActionType::PreAuthorizeEngagement, commander->id, {commander->id}, urgency);
    }

    appendCandidateFromGraph(decision, world, ledger, branch_snapshot, estimator, projected_baseline, ActionType::HoldCurrentCOA, commander->id, {}, urgency);

    if (decision.candidates.empty()) {
        return decision;
    }

    decision.selected = selectBestSupported(decision);
    return decision;
}

void BlueCommanderAgent::step(
    WorldState& world,
    EventLedger& ledger,
    const TemporalCausalGraph& graph,
    const RelationshipGraph& relationships,
    const ActionEffectEstimator& estimator) const {
    if (!world.realtime_agents_enabled || !world.agent_runtime.estimator) return;

    auto& belief = world.agent_beliefs.commander;
    belief.mission_risk = missionRiskScore(world);
    belief.tempo_ratio = missionTempoRatio(world);
    belief.last_evaluation_tick = world.tick;

    if (shouldEmitMonitoring(world.tick, belief.last_monitoring_tick, kAgentMonitoringInterval)) {
        ledger.append(SimEvent{
            0,
            world.tick,
            entityIdFor(world, "blue_commander"),
            EventType::DecideCOA,
            {},
            {{"commander.mission_risk", "unknown", fixed(belief.mission_risk)}, {"commander.tempo_ratio", "unknown", fixed(belief.tempo_ratio)}},
            {},
            {"blue-commander-agent-v1"},
            0.70,
            0.10,
            0.12,
            "continuous mission progress monitoring",
            "maritime ISR cyber/comms scenario",
            "commander_monitoring"});
        belief.last_monitoring_tick = world.tick;
    }

    if (belief.active_coa_id > 0) {
        for (auto& coa : world.coa_log) {
            if (coa.id != belief.active_coa_id) continue;
            if (coa.status == CoaStatus::Executing && world.metrics.target_detected) {
                coa.status = CoaStatus::Completed;
            }
            break;
        }
    }

    if (!world.cyber_degradation_applied) return;

    const bool anomaly_active = world.agent_beliefs.sensor.anomaly_active ||
        world.agent_beliefs.comms.anomaly_active ||
        world.agent_beliefs.causal_monitor.emergence_warning;
    if (anomaly_active && !belief.anomaly_was_active) {
        belief.anomaly_review_pending = true;
    }
    belief.anomaly_was_active = anomaly_active;

    const bool cadence_due = belief.last_coa_review_tick == 0 ||
        world.tick - belief.last_coa_review_tick >= kCoaReviewInterval;
    if (!cadence_due && !belief.anomaly_review_pending) {
        return;
    }

    belief.last_coa_review_tick = world.tick;
    belief.anomaly_review_pending = false;

    const Snapshot branch_snapshot{world, ledger, graph};
    const auto decision = decide(world, ledger, branch_snapshot, relationships, estimator);
    belief.last_action_score = decision.selected.score();

    if (decision.candidates.empty()) return;

    auto* commander = world.entityByName("blue_commander");
    if (!commander) return;

    std::vector<CourseOfAction> recommendations;
    recommendations.reserve(decision.candidates.size());
    for (const auto& candidate : decision.candidates) {
        CourseOfAction coa;
        coa.id = world.next_coa_id++;
        coa.proposed_tick = world.tick;
        coa.action = candidate.type;
        coa.target = targetNameFor(candidate.type);
        coa.expected_mission_gain = candidate.expectedMissionGain;
        coa.causal_confidence = candidate.causalConfidence;
        coa.cost = candidate.cost;
        coa.risk = candidate.risk;
        coa.score = candidate.score();
        coa.rationale = candidate.structuredRationale;
        coa.status = CoaStatus::Recommended;
        coa.scheduled_at_tick = scheduleTickFor(candidate.type, world.tick);
        applyCoaRealism(coa, world);

        {
            const auto* sensor_loss = lastEventWithLabel(ledger, "sensor_confidence_loss");
            const auto* comms_obs = lastEventWithLabel(ledger, "comms_agent_observation");
            const auto* sensor_obs = lastEventWithLabel(ledger, "sensor_agent_observation");
            if (sensor_loss) coa.evidence.source_event_ids.push_back(sensor_loss->event_id);
            else if (comms_obs) coa.evidence.source_event_ids.push_back(comms_obs->event_id);
            else if (sensor_obs) coa.evidence.source_event_ids.push_back(sensor_obs->event_id);
        }
        for (std::size_t path_index = 0; path_index < candidate.causal_path.size(); ++path_index) {
            CoaPathNode node;
            node.node_id = "path-" + std::to_string(path_index);
            node.label = candidate.causal_path[path_index];
            node.type = path_index == 0 ? "observation" : "inference";
            node.confidence = candidate.causalConfidence;
            node.tick = world.tick;
            coa.evidence.dominant_path.push_back(node);
        }
        if (coa.evidence.dominant_path.empty()) {
            for (std::size_t path_index = 0; path_index < candidate.expectedCausalPath.size(); ++path_index) {
                CoaPathNode node;
                node.node_id = "path-" + std::to_string(path_index);
                node.label = std::to_string(candidate.expectedCausalPath[path_index]);
                node.type = path_index == 0 ? "observation" : "inference";
                node.confidence = candidate.causalConfidence;
                node.tick = world.tick;
                coa.evidence.dominant_path.push_back(node);
            }
        }
        if (coa.evidence.dominant_path.empty()) {
            const std::string path_marker = ", path ";
            const auto path_start = candidate.structuredRationale.find(path_marker);
            if (path_start != std::string::npos) {
                const auto path_end = candidate.structuredRationale.find(" for action ");
                const std::string path_segment = candidate.structuredRationale.substr(
                    path_start + path_marker.size(),
                    path_end == std::string::npos ? std::string::npos : path_end - path_start - path_marker.size());
                std::size_t cursor = 0;
                std::size_t path_index = 0;
                while (cursor < path_segment.size()) {
                    const auto arrow = path_segment.find(" -> ", cursor);
                    const std::string label = path_segment.substr(
                        cursor, arrow == std::string::npos ? std::string::npos : arrow - cursor);
                    if (!label.empty()) {
                        CoaPathNode node;
                        node.node_id = "path-" + std::to_string(path_index++);
                        node.label = label;
                        node.type = path_index == 1 ? "observation" : "inference";
                        node.confidence = candidate.causalConfidence;
                        node.tick = world.tick;
                        coa.evidence.dominant_path.push_back(node);
                    }
                    if (arrow == std::string::npos) break;
                    cursor = arrow + 4;
                }
            }
        }
        CoaPathNode action_node;
        action_node.node_id = "coa-action-" + std::to_string(coa.id);
        action_node.label = toString(candidate.type);
        action_node.type = "action";
        action_node.confidence = candidate.causalConfidence;
        action_node.tick = coa.scheduled_at_tick;
        coa.evidence.dominant_path.push_back(action_node);
        CoaPathNode outcome_node;
        outcome_node.node_id = "coa-outcome-" + std::to_string(coa.id);
        outcome_node.label = "mission_recovery";
        outcome_node.type = "outcome";
        outcome_node.confidence = candidate.expectedMissionGain;
        outcome_node.tick = coa.scheduled_at_tick;
        coa.evidence.dominant_path.push_back(outcome_node);

        recommendations.push_back(coa);
        world.coa_log.push_back(coa);
    }

    std::sort(recommendations.begin(), recommendations.end(), [](const CourseOfAction& lhs, const CourseOfAction& rhs) {
        if (lhs.action == ActionType::HoldCurrentCOA) return false;
        if (rhs.action == ActionType::HoldCurrentCOA) return true;
        return lhs.score > rhs.score;
    });

    {
        std::vector<double> weights;
        for (const auto& coa : recommendations) {
            weights.push_back(std::max(0.001, coa.score + 1.0));
        }
        double total = 0.0;
        for (double weight : weights) total += weight;
        double entropy = 0.0;
        for (double weight : weights) {
            const double p = weight / total;
            entropy -= p * std::log2(p);
        }
        belief.coa_entropy = entropy;
    }

    std::vector<StateDelta> recommendation_deltas{
        {"coa.review_tick", std::to_string(belief.last_coa_review_tick), std::to_string(world.tick)},
        {"coa.selected_action", "none", toString(decision.selected.type)},
        {"authority.mode", "none", toString(world.authorization_mode)}};
    for (std::size_t i = 0; i < recommendations.size() && i < 5; ++i) {
        const auto& coa = recommendations[i];
        recommendation_deltas.push_back({"coa.rank." + std::to_string(i + 1) + ".id", "0", std::to_string(coa.id)});
        recommendation_deltas.push_back({"coa.rank." + std::to_string(i + 1) + ".action", "none", toString(coa.action)});
        recommendation_deltas.push_back({"coa.rank." + std::to_string(i + 1) + ".score", "0.000", scoreText(coa.score)});
        recommendation_deltas.push_back({"coa.rank." + std::to_string(i + 1) + ".gain", "0.000", scoreText(coa.expected_mission_gain)});
        recommendation_deltas.push_back({"coa.rank." + std::to_string(i + 1) + ".confidence", "0.000", scoreText(coa.causal_confidence)});
        recommendation_deltas.push_back({"coa.rank." + std::to_string(i + 1) + ".status", "none", toString(coa.status)});
        recommendation_deltas.push_back({"coa.rank." + std::to_string(i + 1) + ".gate", "none", coa.gate_disposition});
        recommendation_deltas.push_back({"coa.rank." + std::to_string(i + 1) + ".mc_gain", "0.000", scoreText(coa.mc_expected_mission_gain_mean)});
    }

    std::vector<EventId> recommendation_parents;
    if (const auto* sensor_loss = lastEventWithLabel(ledger, "sensor_confidence_loss")) {
        recommendation_parents.push_back(sensor_loss->event_id);
    } else if (const auto* comms_obs = lastEventWithLabel(ledger, "comms_agent_observation")) {
        recommendation_parents.push_back(comms_obs->event_id);
    } else if (const auto* sensor_obs = lastEventWithLabel(ledger, "sensor_agent_observation")) {
        recommendation_parents.push_back(sensor_obs->event_id);
    }

    ledger.append(SimEvent{
        0,
        world.tick,
        commander->id,
        EventType::PolicyChangeProposed,
        decision.selected.targets,
        recommendation_deltas,
        recommendation_parents,
        {"blue-commander-agent-v1"},
        decision.selected.causalConfidence,
        0.10,
        decision.selected.uncertaintyPenalty,
        "continuous ranked COA recommendation",
        "maritime ISR cyber/comms scenario",
        "coa_recommendation"});

    if (belief.primary_decision_recorded) {
        return;
    }

    const CandidateAction& selected = decision.selected;
    const Tick scheduled_at = scheduleTickFor(selected.type, world.tick);
    const AuthorityDecision authority = evaluateAuthority(world, selected, scheduled_at);

    CourseOfAction* active_coa = nullptr;
    for (auto it = world.coa_log.rbegin(); it != world.coa_log.rend(); ++it) {
        if (it->proposed_tick != world.tick || it->action != selected.type) continue;
        if (authority.approved) {
            it->status = CoaStatus::Executing;
            active_coa = &(*it);
            belief.active_coa_id = it->id;
        } else if (selected.type != ActionType::HoldCurrentCOA) {
            it->status = CoaStatus::Recommended;
        }
        break;
    }

    if (authority.approved && active_coa) {
        for (auto& coa : world.coa_log) {
            if (coa.proposed_tick == world.tick && coa.id != active_coa->id &&
                (coa.status == CoaStatus::Recommended || coa.status == CoaStatus::Proposed)) {
                coa.status = CoaStatus::Superseded;
            }
        }
    }

    if (!authority.approved || selected.type == ActionType::HoldCurrentCOA) {
        return;
    }

    std::vector<EventId> parents = recommendation_parents;

    ledger.append(SimEvent{
        0,
        world.tick,
        commander->id,
        EventType::PolicyChangeAccepted,
        selected.targets,
        {{"agent.selected_action", "none", toString(selected.type)},
            {"agent.action_score", "0.000", scoreText(selected.score())},
            {"agent.causal_gain", "0.000", scoreText(selected.expectedMissionGain)},
            {"agent.partial_observability.p_cyber", "0.000", scoreText(world.agent_beliefs.commander.p_cyber_compromise)},
            {"authority.reason", "none", authority.reason},
            {"authority.mode", "none", toString(world.authorization_mode)}},
        parents,
        {"blue-commander-agent-v1"},
        selected.causalConfidence,
        0.10,
        selected.uncertaintyPenalty,
        selected.structuredRationale,
        "maritime ISR cyber/comms scenario",
        "online_agent_decision"});

    world.scheduled_interventions.push_back(ScheduledIntervention{
        toString(selected.type),
        scheduled_at,
        targetNameFor(selected.type),
        false});

    belief.primary_decision_recorded = true;
    belief.last_selected_action = toString(selected.type);
}

} // namespace darla
