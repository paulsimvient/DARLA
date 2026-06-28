#include "ScriptComponent.h"

namespace darla {

std::string scriptIdFor(const PythonScriptConfig& config) {
    return config.object_id + ":" + config.class_name;
}

std::string toString(ScriptCommandType type) {
    switch (type) {
    case ScriptCommandType::EmitEvent: return "emit_event";
    case ScriptCommandType::ProposeCoa: return "propose_coa";
    case ScriptCommandType::ScheduleAction: return "schedule_action";
    case ScriptCommandType::Log: return "log";
    }
    return "unknown";
}

} // namespace darla
