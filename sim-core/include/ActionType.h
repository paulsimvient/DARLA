#pragma once

#include <string>

namespace darla {

enum class ActionType {
    IsolateCompromisedSensorFeed,
    RestoreCommsRelay,
    EnableAutonomousSearch,
    PreAuthorizeEngagement,
    HoldCurrentCOA
};

std::string toString(ActionType type);
ActionType actionTypeFromString(const std::string& value);

} // namespace darla
