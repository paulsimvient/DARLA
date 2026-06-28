#include "sim-graph/TemporalCausalGraph.h"

namespace darla {

std::string toString(CausalEdgeType type) {
    switch (type) {
    case CausalEdgeType::Enables: return "Enables";
    case CausalEdgeType::Degrades: return "Degrades";
    case CausalEdgeType::Delays: return "Delays";
    case CausalEdgeType::Suppresses: return "Suppresses";
    case CausalEdgeType::Confounds: return "Confounds";
    case CausalEdgeType::Observes: return "Observes";
    case CausalEdgeType::Commands: return "Commands";
    case CausalEdgeType::DependsOn: return "DependsOn";
    case CausalEdgeType::CausesMissionEffect: return "CausesMissionEffect";
    }
    return "Unknown";
}

void TemporalCausalGraph::addEdge(const SimEvent& source, const SimEvent& target, CausalEdgeType type, double strength, double confidence, const std::string& label) {
    edges_.push_back(TemporalCausalEdge{source.event_id, target.event_id, type, strength, confidence, source.tick, target.tick, false, false, label});
}

std::vector<std::string> TemporalCausalGraph::dominantPathLabels() const {
    std::vector<std::string> labels;
    for (const auto& edge : edges_) {
        if (!edge.label.empty() && edge.type != CausalEdgeType::Confounds) {
            labels.push_back(edge.label);
        }
    }
    return labels;
}

} // namespace darla
