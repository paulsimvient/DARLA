#pragma once

#include "Types.h"

#include <string>
#include <vector>

namespace darla {

enum class ClaimStatus {
    DirectlyAdjudicated,
    Identifiable,
    WeaklyIdentifiable,
    Confounded,
    NotIdentifiable,
    Falsified
};

struct CausalClaim {
    NodeId cause = 0;
    NodeId effect = 0;
    ClaimStatus status = ClaimStatus::NotIdentifiable;
    double effect_size = 0.0;
    double confidence = 0.0;
    double sensitivity_to_assumptions = 0.0;
    std::vector<EventId> evidence;
    std::vector<std::string> confounders;
    std::vector<std::string> falsification_tests;
    std::string cause_variable;
    std::string effect_variable;
    std::string label;
};

std::string toString(ClaimStatus status);

} // namespace darla
