#include "CourseOfAction.h"

#include <sstream>
#include <stdexcept>

namespace darla {

std::string toString(CoaStatus status) {
    switch (status) {
    case CoaStatus::Proposed: return "proposed";
    case CoaStatus::Recommended: return "recommended";
    case CoaStatus::Approved: return "approved";
    case CoaStatus::Executing: return "executing";
    case CoaStatus::Completed: return "completed";
    case CoaStatus::Superseded: return "superseded";
    case CoaStatus::Rejected: return "rejected";
    }
    return "unknown";
}

std::string toString(AuthorizationMode mode) {
    switch (mode) {
    case AuthorizationMode::PolicyAuto: return "policy_auto";
    case AuthorizationMode::ExplicitApprovals: return "explicit_approvals";
    case AuthorizationMode::HumanHold: return "human_hold";
    }
    return "unknown";
}

AuthorizationMode authorizationModeFromString(const std::string& value) {
    if (value == "policy_auto" || value == "auto") return AuthorizationMode::PolicyAuto;
    if (value == "explicit_approvals" || value == "explicit") return AuthorizationMode::ExplicitApprovals;
    if (value == "human_hold" || value == "hold") return AuthorizationMode::HumanHold;
    throw std::invalid_argument("unknown authorization mode: " + value);
}

bool parseApprovedCoa(const std::string& token, ApprovedCoa* out) {
    if (!out) return false;
    const auto at_pos = token.find('@');
    if (at_pos == std::string::npos) return false;

    const std::string action_name = token.substr(0, at_pos);
    const Tick at_tick = static_cast<Tick>(std::stoull(token.substr(at_pos + 1)));

    if (action_name == "isolate_compromised_sensor_feed") {
        out->action = ActionType::IsolateCompromisedSensorFeed;
    } else if (action_name == "restore_comms_relay") {
        out->action = ActionType::RestoreCommsRelay;
    } else if (action_name == "enable_autonomous_search") {
        out->action = ActionType::EnableAutonomousSearch;
    } else if (action_name == "pre_authorize_engagement") {
        out->action = ActionType::PreAuthorizeEngagement;
    } else if (action_name == "hold_current_coa") {
        out->action = ActionType::HoldCurrentCOA;
    } else {
        return false;
    }

    out->at_tick = at_tick;
    return true;
}

} // namespace darla
