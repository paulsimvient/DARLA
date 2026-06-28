#include "sim-tools/SimCommandProcessor.h"

#include "ActionType.h"

#include <sstream>

namespace darla {
namespace {

CourseOfAction* findCoaById(WorldState& world, int coa_id) {
    for (auto& coa : world.coa_log) {
        if (coa.id == coa_id) return &coa;
    }
    return nullptr;
}

CourseOfAction* findCoaByActionTick(WorldState& world, ActionType action, Tick scheduled_at_tick) {
    for (auto& coa : world.coa_log) {
        if (coa.action == action && coa.scheduled_at_tick == scheduled_at_tick) return &coa;
    }
    return nullptr;
}

EntityId commanderEntityId(const WorldState& world) {
    if (const auto* commander = world.entityByName("blue_commander")) {
        return commander->id;
    }
    return 0;
}

std::string extractJsonString(const std::string& json, const std::string& key) {
    const std::string needle = "\"" + key + "\":\"";
    const auto start = json.find(needle);
    if (start == std::string::npos) return {};
    const auto value_start = start + needle.size();
    const auto end = json.find('"', value_start);
    if (end == std::string::npos) return {};
    return json.substr(value_start, end - value_start);
}

int extractJsonInt(const std::string& json, const std::string& key) {
    const std::string needle = "\"" + key + "\":";
    const auto start = json.find(needle);
    if (start == std::string::npos) return 0;
    return std::stoi(json.substr(start + needle.size()));
}

} // namespace

SimCommandResult applyApproveCoa(WorldState& world, EventLedger& ledger, const ApproveCoaCommand& command) {
    SimCommandResult result;
    const ActionType action = actionTypeFromString(command.action);
    if (action == ActionType::HoldCurrentCOA) {
        result.message = "hold_current_coa cannot be approved as intervention";
        return result;
    }

    world.approved_coas.push_back(ApprovedCoa{action, command.scheduled_at_tick});

    CourseOfAction* coa = command.coa_id > 0 ? findCoaById(world, command.coa_id)
                                             : findCoaByActionTick(world, action, command.scheduled_at_tick);
    if (coa == nullptr) {
        result.message = "COA not found";
        return result;
    }

    coa->status = CoaStatus::Approved;
    world.agent_beliefs.commander.active_coa_id = coa->id;

    for (auto& other : world.coa_log) {
        if (other.id != coa->id && other.proposed_tick == coa->proposed_tick &&
            (other.status == CoaStatus::Recommended || other.status == CoaStatus::Proposed)) {
            other.status = CoaStatus::Superseded;
        }
    }

    std::vector<StateDelta> deltas{
        {"coa_id", "0", std::to_string(command.coa_id)},
        {"action", "none", command.action},
        {"target", "none", command.target},
        {"scheduled_at_tick", "0", std::to_string(command.scheduled_at_tick)},
        {"issued_at_tick", "0", std::to_string(command.issued_at_tick)},
        {"authority", "none", command.authority}};

    const Tick event_tick = command.issued_at_tick > 0 ? command.issued_at_tick : world.tick;
    result.event_id = ledger.append(SimEvent{
        0,
        event_tick,
        commanderEntityId(world),
        EventType::HumanApprovedCoa,
        {},
        deltas,
        coa->evidence.source_event_ids,
        {"human-commander"},
        coa->causal_confidence,
        0.05,
        0.05,
        "human operator approved COA",
        "explicit approval command",
        "human_approved_coa"});

    coa->status = CoaStatus::Executing;
    world.scheduled_interventions.push_back(ScheduledIntervention{
        command.action,
        command.scheduled_at_tick,
        command.target,
        false});
    world.agent_beliefs.commander.primary_decision_recorded = true;
    world.agent_beliefs.commander.last_selected_action = command.action;

    result.ok = true;
    result.message = "COA approved and intervention scheduled";
    result.command_type = "approve_coa";
    return result;
}

SimCommandResult applyRejectCoa(WorldState& world, EventLedger& ledger, const RejectCoaCommand& command) {
    SimCommandResult result;
    CourseOfAction* coa = findCoaById(world, command.coa_id);
    if (coa == nullptr) {
        result.message = "COA not found";
        return result;
    }

    coa->status = CoaStatus::Rejected;
    std::vector<StateDelta> deltas{
        {"coa_id", "0", std::to_string(command.coa_id)},
        {"reason", "none", command.reason.empty() ? "operator rejected" : command.reason}};

    result.event_id = ledger.append(SimEvent{
        0,
        world.tick,
        commanderEntityId(world),
        EventType::HumanRejectedCoa,
        {},
        deltas,
        coa->evidence.source_event_ids,
        {"human-commander"},
        1.0,
        0.0,
        0.0,
        command.reason.empty() ? "human operator rejected COA" : command.reason,
        "explicit rejection command",
        "human_rejected_coa"});

    result.ok = true;
    result.message = "COA rejected";
    result.command_type = "reject_coa";
    return result;
}

SimCommandResult applyManualIntervention(WorldState& world, EventLedger& ledger, const ManualInterventionCommand& command) {
    SimCommandResult result;
    const ActionType action = actionTypeFromString(command.action);
    if (action == ActionType::HoldCurrentCOA) {
        result.message = "invalid manual intervention action";
        return result;
    }

    world.scheduled_interventions.push_back(ScheduledIntervention{
        command.action,
        command.requested_tick,
        command.target,
        false});

    std::vector<StateDelta> deltas{
        {"action", "none", command.action},
        {"target", "none", command.target},
        {"requested_tick", "0", std::to_string(command.requested_tick)}};

    result.event_id = ledger.append(SimEvent{
        0,
        world.tick,
        commanderEntityId(world),
        EventType::ManualIntervention,
        {},
        deltas,
        {},
        {"human-commander"},
        1.0,
        0.0,
        0.0,
        "manual intervention requested",
        "operator command",
        "manual_intervention"});

    result.ok = true;
    result.message = "manual intervention scheduled";
    result.command_type = "manual_intervention";
    return result;
}

SimCommandResult processCommandJson(WorldState& world, EventLedger& ledger, const std::string& json_line) {
    SimCommandResult result;
    const std::string type = extractJsonString(json_line, "type");
    if (type == "approve_coa") {
        ApproveCoaCommand command;
        command.coa_id = extractJsonInt(json_line, "coa_id");
        command.action = extractJsonString(json_line, "action");
        command.target = extractJsonString(json_line, "target");
        command.scheduled_at_tick = static_cast<Tick>(extractJsonInt(json_line, "scheduled_at_tick"));
        command.issued_at_tick = static_cast<Tick>(extractJsonInt(json_line, "issued_at_tick"));
        command.authority = extractJsonString(json_line, "authority");
        if (command.authority.empty()) command.authority = "human";
        auto applied = applyApproveCoa(world, ledger, command);
        applied.command_type = "approve_coa";
        return applied;
    }
    if (type == "reject_coa") {
        RejectCoaCommand command;
        command.coa_id = extractJsonInt(json_line, "coa_id");
        command.reason = extractJsonString(json_line, "reason");
        auto applied = applyRejectCoa(world, ledger, command);
        applied.command_type = "reject_coa";
        return applied;
    }
    if (type == "manual_intervention") {
        ManualInterventionCommand command;
        command.action = extractJsonString(json_line, "action");
        command.target = extractJsonString(json_line, "target");
        command.requested_tick = static_cast<Tick>(extractJsonInt(json_line, "requested_tick"));
        auto applied = applyManualIntervention(world, ledger, command);
        applied.command_type = "manual_intervention";
        return applied;
    }
    if (type == "continue_review") {
        result.ok = true;
        result.message = "review hold released";
        result.command_type = "continue_review";
        return result;
    }

    result.command_type = type;
    result.message = "unknown command type: " + type;
    return result;
}

} // namespace darla
