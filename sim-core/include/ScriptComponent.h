#pragma once

#include "ActionType.h"
#include "Types.h"

#include <map>
#include <string>
#include <vector>

namespace darla {

struct PythonScriptConfig {
    std::string object_id;
    std::string script_path;
    std::string class_name;
    bool enabled = true;
    std::map<std::string, std::string> params;
};

struct PythonScriptRuntimeState {
    std::string script_id;
    std::string object_id;
    std::string script_path;
    std::string class_name;
    bool enabled = true;
    bool loaded = false;
    std::string last_reload_status;
    std::string last_error;
    Tick last_tick = 0;
    std::size_t emitted_events = 0;
    std::size_t proposed_coas = 0;
    std::size_t scheduled_actions = 0;
};

enum class ScriptCommandType {
    EmitEvent,
    ProposeCoa,
    ScheduleAction,
    Log
};

struct ScriptCommand {
    std::string script_id;
    std::string object_id;
    Tick issued_at_tick = 0;
    ScriptCommandType type = ScriptCommandType::Log;
    std::string action;
    std::string target;
    std::string label;
    double confidence = 1.0;
    double expected_mission_gain = 0.0;
    double causal_confidence = 0.0;
    double cost = 0.0;
    double risk = 0.0;
    Tick at_tick = 0;
    std::string rationale;
    std::map<std::string, std::string> payload;
};

std::string scriptIdFor(const PythonScriptConfig& config);
std::string toString(ScriptCommandType type);

} // namespace darla
