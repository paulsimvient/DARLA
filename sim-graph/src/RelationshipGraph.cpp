#include "sim-graph/RelationshipGraph.h"

namespace darla {

void RelationshipGraph::addEdge(RelationshipEdge edge) {
    edges_.push_back(std::move(edge));
}

std::vector<RelationshipEdge> RelationshipGraph::edgesFrom(const std::string& source, RelationshipType type) const {
    std::vector<RelationshipEdge> matches;
    for (const auto& edge : edges_) {
        if (edge.source == source && edge.type == type) {
            matches.push_back(edge);
        }
    }
    return matches;
}

std::vector<RelationshipEdge> RelationshipGraph::edgesTo(const std::string& target, RelationshipType type) const {
    std::vector<RelationshipEdge> matches;
    for (const auto& edge : edges_) {
        if (edge.target == target && edge.type == type) {
            matches.push_back(edge);
        }
    }
    return matches;
}

std::vector<RelationshipEdge> RelationshipGraph::edgesOfType(RelationshipType type) const {
    std::vector<RelationshipEdge> matches;
    for (const auto& edge : edges_) {
        if (edge.type == type) {
            matches.push_back(edge);
        }
    }
    return matches;
}

RelationshipGraph RelationshipGraph::maritimeMicroWorldDefault() {
    RelationshipGraph graph;
    graph.addEdge({RelationshipType::Commands, "blue_commander", "blue_uas_1", {}, 1.0});
    graph.addEdge({RelationshipType::CommunicatesWith, "blue_commander", "blue_relay_1", "comms", 1.0});
    graph.addEdge({RelationshipType::DependsOn, "blue_uas_1", "blue_relay_1", "comms", 1.0});
    graph.addEdge({RelationshipType::Senses, "blue_uas_1", "red_maritime_target", "sensor", 1.0});
    graph.addEdge({RelationshipType::Degrades, "red_cyber_actor", "blue_uas_1", "sensor", 1.0});
    graph.addEdge({RelationshipType::Supports, "blue_relay_1", "blue_commander", "comms", 1.0});
    graph.addEdge({RelationshipType::Supports, "blue_relay_1", "blue_uas_1", "comms", 1.0});
    graph.addEdge({RelationshipType::Supplies, "logistics_support_node", "blue_commander", {}, 1.0});
    return graph;
}

RelationshipGraph RelationshipGraph::fromScenario(const Scenario& scenario) {
    if (!scenario.relationships.empty()) {
        RelationshipGraph graph;
        for (const auto& edge : scenario.relationships) {
            graph.addEdge(edge);
        }
        return graph;
    }
    return maritimeMicroWorldDefault();
}

} // namespace darla
