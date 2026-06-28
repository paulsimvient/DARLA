#pragma once

#include <string>

namespace darla {

enum class RelationshipType {
    Commands,
    Supports,
    DependsOn,
    Senses,
    Degrades,
    CommunicatesWith,
    Supplies
};

struct RelationshipEdge {
    RelationshipType type = RelationshipType::DependsOn;
    std::string source;
    std::string target;
    std::string component;
    double weight = 1.0;
};

std::string toString(RelationshipType type);
RelationshipType relationshipTypeFromString(const std::string& value);

} // namespace darla
