#include "RelationshipTypes.h"

namespace darla {

std::string toString(RelationshipType type) {
    switch (type) {
    case RelationshipType::Commands: return "commands";
    case RelationshipType::Supports: return "supports";
    case RelationshipType::DependsOn: return "depends_on";
    case RelationshipType::Senses: return "senses";
    case RelationshipType::Degrades: return "degrades";
    case RelationshipType::CommunicatesWith: return "communicates_with";
    case RelationshipType::Supplies: return "supplies";
    }
    return "depends_on";
}

RelationshipType relationshipTypeFromString(const std::string& value) {
    if (value == "commands") return RelationshipType::Commands;
    if (value == "supports") return RelationshipType::Supports;
    if (value == "depends_on") return RelationshipType::DependsOn;
    if (value == "senses") return RelationshipType::Senses;
    if (value == "degrades") return RelationshipType::Degrades;
    if (value == "communicates_with") return RelationshipType::CommunicatesWith;
    if (value == "supplies") return RelationshipType::Supplies;
    return RelationshipType::DependsOn;
}

} // namespace darla
