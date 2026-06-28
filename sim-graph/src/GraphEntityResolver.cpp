#include "sim-graph/GraphEntityResolver.h"

namespace darla {

EntityId entityIdForName(const WorldState& world, const std::string& name) {
    const auto it = world.ids_by_name.find(name);
    return it == world.ids_by_name.end() ? 0 : it->second;
}

std::optional<std::string> firstGraphTarget(
    const WorldState& world,
    const RelationshipGraph& graph,
    const std::string& source,
    RelationshipType type) {
    const auto edges = graph.edgesFrom(source, type);
    if (edges.empty()) return std::nullopt;
    return edges.front().target;
}

EntityId firstGraphTargetId(
    const WorldState& world,
    const RelationshipGraph& graph,
    const std::string& source,
    RelationshipType type) {
    const auto target = firstGraphTarget(world, graph, source, type);
    if (!target) return 0;
    return entityIdForName(world, *target);
}

} // namespace darla
