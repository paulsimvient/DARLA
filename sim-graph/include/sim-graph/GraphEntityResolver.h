#pragma once

#include "RelationshipTypes.h"
#include "WorldState.h"
#include "sim-graph/RelationshipGraph.h"

#include <optional>
#include <string>

namespace darla {

EntityId entityIdForName(const WorldState& world, const std::string& name);
std::optional<std::string> firstGraphTarget(
    const WorldState& world,
    const RelationshipGraph& graph,
    const std::string& source,
    RelationshipType type);
EntityId firstGraphTargetId(
    const WorldState& world,
    const RelationshipGraph& graph,
    const std::string& source,
    RelationshipType type);

} // namespace darla
