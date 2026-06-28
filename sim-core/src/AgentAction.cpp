#include "ActionType.h"

namespace darla {

std::string toString(ActionType type) {
    switch (type) {
    case ActionType::IsolateCompromisedSensorFeed: return "isolate_compromised_sensor_feed";
    case ActionType::RestoreCommsRelay: return "restore_comms_relay";
    case ActionType::EnableAutonomousSearch: return "enable_autonomous_search";
    case ActionType::PreAuthorizeEngagement: return "pre_authorize_engagement";
    case ActionType::HoldCurrentCOA: return "hold_current_coa";
    }
    return "unknown";
}

ActionType actionTypeFromString(const std::string& value) {
    if (value == "isolate_compromised_sensor_feed") return ActionType::IsolateCompromisedSensorFeed;
    if (value == "restore_comms_relay") return ActionType::RestoreCommsRelay;
    if (value == "enable_autonomous_search") return ActionType::EnableAutonomousSearch;
    if (value == "pre_authorize_engagement") return ActionType::PreAuthorizeEngagement;
    if (value == "hold_current_coa") return ActionType::HoldCurrentCOA;
    return ActionType::HoldCurrentCOA;
}

} // namespace darla
