#include "sim-adjudication/EmergenceDetector.h"

#include <cmath>
#include <sstream>

namespace darla {
namespace {

double computeCoaEntropy(const WorldState& world) {
    Tick latest_review = 0;
    for (const auto& coa : world.coa_log) {
        if (coa.proposed_tick >= latest_review) {
            latest_review = coa.proposed_tick;
        }
    }
    if (latest_review == 0) {
        return world.agent_beliefs.commander.coa_entropy;
    }

    std::vector<double> weights;
    for (const auto& coa : world.coa_log) {
        if (coa.proposed_tick != latest_review) continue;
        if (coa.status == CoaStatus::Superseded || coa.status == CoaStatus::Rejected) continue;
        const double weight = std::max(0.001, coa.score + 1.0);
        weights.push_back(weight);
    }
    if (weights.empty()) return 0.0;

    double total = 0.0;
    for (double weight : weights) total += weight;
    double entropy = 0.0;
    for (double weight : weights) {
        const double p = weight / total;
        entropy -= p * std::log2(p);
    }
    return entropy;
}

} // namespace

EmergenceDetection EmergenceDetector::evaluate(const WorldState& world, const EventLedger& ledger) const {
    EmergenceDetection detection;
    const auto* uas = world.entityByName("blue_uas_1");
    const auto* relay = world.entityByName("blue_relay_1");

    if (world.metrics.target_detected && world.metrics.coa_selection_time > world.metrics.detection_time) {
        detection.metrics.decision_latency = static_cast<double>(world.metrics.coa_selection_time - world.metrics.detection_time);
    }
    if (uas && uas->sensor) {
        detection.metrics.sensor_trust = uas->sensor->confidence;
    }
    if (relay && relay->comms) {
        detection.metrics.comms_congestion = relay->comms->packet_loss + (relay->comms->latency_sec / 20.0);
    }
    if (world.mission.target_detected_before_tick > 0 && world.metrics.detection_time > 0) {
        detection.metrics.mission_tempo_ratio = static_cast<double>(world.metrics.detection_time) / static_cast<double>(world.mission.target_detected_before_tick);
    }
    detection.metrics.coa_delay_penalty = world.engagement_pre_authorized ? 0.0 : 1.0;
    detection.metrics.coa_entropy = computeCoaEntropy(world);

    if (detection.metrics.mission_tempo_ratio > 0.85 && detection.metrics.sensor_trust < 0.65) {
        detection.patterns.push_back("pre_failure_tempo_stress");
    }
    if (detection.metrics.mission_tempo_ratio > 1.0 && detection.metrics.decision_latency > 80.0) {
        detection.patterns.push_back("operational_tempo_collapse");
    }
    if (detection.metrics.sensor_trust < 0.55) {
        detection.patterns.push_back("sensor_trust_collapse");
    }
    if (detection.metrics.comms_congestion > 0.25) {
        detection.patterns.push_back("comms_cascade");
    }
    if (detection.metrics.mission_tempo_ratio > 1.05) {
        detection.patterns.push_back("mission_tempo_degradation");
    }
    if (detection.metrics.coa_entropy > 1.2) {
        detection.patterns.push_back("coa_entropy_spike");
    }

    detection.detected = !detection.patterns.empty();
    if (detection.detected) {
        std::ostringstream out;
        for (std::size_t i = 0; i < detection.patterns.size(); ++i) {
            if (i > 0) out << ", ";
            out << detection.patterns[i];
        }
        detection.summary = "metric-based emergence detected: " + out.str();
    } else if (!world.mission_effect_recorded || world.metrics.mission_success) {
        detection.summary = "mission success; no emergence patterns detected";
    } else {
        detection.summary = "mission failed without crossing emergence thresholds";
    }

    (void)ledger;
    return detection;
}

} // namespace darla
