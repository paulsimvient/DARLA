#pragma once

#include "ActionType.h"
#include "Types.h"

#include <string>
#include <vector>

namespace darla {

enum class CoaStatus {
    Proposed,
    Recommended,
    Approved,
    Executing,
    Completed,
    Superseded,
    Rejected
};

enum class AuthorizationMode {
    PolicyAuto,
    ExplicitApprovals,
    HumanHold
};

struct ApprovedCoa {
    ActionType action = ActionType::HoldCurrentCOA;
    Tick at_tick = 0;
};

struct CoaPathNode {
    std::string node_id;
    std::string label;
    std::string type;
    double confidence = 0.0;
    Tick tick = 0;
};

struct CoaEvidence {
    std::vector<EventId> source_event_ids;
    std::vector<std::string> causal_edge_ids;
    std::vector<CoaPathNode> dominant_path;
    std::string falsification_summary;
    std::string replay_hash;
};

struct CourseOfAction {
    int id = 0;
    Tick proposed_tick = 0;
    ActionType action = ActionType::HoldCurrentCOA;
    std::string target;
    double expected_mission_gain = 0.0;
    double causal_confidence = 0.0;
    double cost = 0.0;
    double risk = 0.0;
    double score = 0.0;
    std::string rationale;
    CoaEvidence evidence;
    CoaStatus status = CoaStatus::Proposed;
    Tick scheduled_at_tick = 0;
};

std::string toString(CoaStatus status);
std::string toString(AuthorizationMode mode);
AuthorizationMode authorizationModeFromString(const std::string& value);
bool parseApprovedCoa(const std::string& token, ApprovedCoa* out);

} // namespace darla
