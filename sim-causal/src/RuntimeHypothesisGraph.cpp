#include "sim-causal/RuntimeHypothesisGraph.h"

#include <algorithm>
#include <cctype>
#include <map>
#include <set>
#include <sstream>

namespace darla {
namespace {

std::string lower(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char c) {
        return static_cast<char>(std::tolower(c));
    });
    return value;
}

double clamp01(double value) {
    return std::max(0.0, std::min(1.0, value));
}

bool contains(const std::string& text, const std::string& needle) {
    return text.find(needle) != std::string::npos;
}

std::string eventText(const SimEvent& event) {
    std::ostringstream out;
    out << lower(toString(event.type)) << ' ' << lower(event.label);
    for (const auto& delta : event.deltas) {
        out << ' ' << lower(delta.field) << ':' << lower(delta.before) << "->" << lower(delta.after);
    }
    return out.str();
}

} // namespace

std::string inferCausalVariable(const SimEvent& event) {
    const auto text = eventText(event);
    if (contains(text, "cyber") || contains(text, "degrad")) return "red_cyber_actor.cyber_effect";
    if (contains(text, "sensor") || contains(text, "confidence")) return "blue_uas_1.sensor.confidence";
    if (contains(text, "detect") || contains(text, "target")) return "detection_time";
    if (contains(text, "mission") || contains(text, "success")) return "mission_success_score";
    if (contains(text, "coa") || contains(text, "decision")) return "commander.coa_decision";
    if (!event.deltas.empty()) return event.deltas.front().field;
    return event.label;
}

RuntimeHypothesisGraph buildRuntimeHypothesisGraph(
    const std::vector<SimEvent>& events,
    const RuntimeHypothesisConfig& config) {
    RuntimeHypothesisGraph graph;
    std::map<EventId, const SimEvent*> by_id;
    for (const auto& event : events) by_id[event.event_id] = &event;

    std::map<std::string, RuntimeCausalEdgeEvidence> best_by_edge;
    for (const auto& target : events) {
        for (const auto parent_id : target.causal_parent_events) {
            const auto it = by_id.find(parent_id);
            if (it == by_id.end()) continue;
            const SimEvent& source = *it->second;

            const auto cause = inferCausalVariable(source);
            const auto effect = inferCausalVariable(target);
            if (cause == effect) continue;

            const auto source_text = eventText(source);
            const auto target_text = eventText(target);
            RuntimeCausalEdgeEvidence evidence;
            evidence.cause = cause;
            evidence.effect = effect;
            evidence.temporal_precedence = target.tick >= source.tick ? 0.85 : 0.0;
            evidence.state_delta_support = target.deltas.empty() ? 0.2 : 0.65;
            evidence.intervention_contrast = contains(source_text, "intervention") || contains(source_text, "isolate") ? 0.7 : 0.15;
            evidence.counterfactual_support = contains(source_text, "coa") || contains(target_text, "mission") ? 0.45 : 0.2;
            evidence.relationship_prior = config.allow_domain_priors ? 0.35 : 0.0;
            evidence.falsification_survival = target.confidence >= 0.5 ? 0.65 : 0.35;
            evidence.confounding_penalty = contains(target_text, "weather") || contains(target_text, "logistics") ? 0.25 : 0.05;
            evidence.total_score = clamp01(
                0.18 * evidence.temporal_precedence +
                0.18 * evidence.state_delta_support +
                0.22 * evidence.intervention_contrast +
                0.18 * evidence.counterfactual_support +
                0.10 * evidence.relationship_prior +
                0.14 * evidence.falsification_survival -
                0.20 * evidence.confounding_penalty);
            evidence.supporting_event_ids = {source.event_id, target.event_id};
            evidence.explanation = evidence.total_score >= config.accept_threshold
                ? "runtime evidence supports a causal hypothesis edge"
                : "candidate edge needs more intervention/counterfactual support";

            const auto key = evidence.cause + "->" + evidence.effect;
            const auto current = best_by_edge.find(key);
            if (current == best_by_edge.end() || evidence.total_score > current->second.total_score) {
                best_by_edge[key] = evidence;
            }
        }
    }

    for (const auto& [_, edge] : best_by_edge) {
        graph.edges.push_back(edge);
    }
    std::sort(graph.edges.begin(), graph.edges.end(), [](const auto& a, const auto& b) {
        return a.total_score > b.total_score;
    });
    return graph;
}

} // namespace darla
