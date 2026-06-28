#pragma once

#include "RelationshipTypes.h"
#include "WorldState.h"

#include <vector>

namespace darla {

class RelationshipGraph {
public:
    void addEdge(RelationshipEdge edge);
    const std::vector<RelationshipEdge>& edges() const { return edges_; }

    std::vector<RelationshipEdge> edgesFrom(const std::string& source, RelationshipType type) const;
    std::vector<RelationshipEdge> edgesTo(const std::string& target, RelationshipType type) const;
    std::vector<RelationshipEdge> edgesOfType(RelationshipType type) const;

    static RelationshipGraph maritimeMicroWorldDefault();
    static RelationshipGraph fromScenario(const Scenario& scenario);

private:
    std::vector<RelationshipEdge> edges_;
};

} // namespace darla
