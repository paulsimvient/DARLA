#pragma once

#include "CourseOfAction.h"
#include "SimulationKernel.h"
#include "sim-events/EventLedger.h"

#include <string>

namespace darla {

struct ApproveCoaCommand {
    int coa_id = 0;
    std::string action;
    std::string target;
    Tick scheduled_at_tick = 0;
    Tick issued_at_tick = 0;
    std::string authority = "human";
};

struct RejectCoaCommand {
    int coa_id = 0;
    std::string reason;
};

struct ManualInterventionCommand {
    std::string action;
    std::string target;
    Tick requested_tick = 0;
};

struct SimCommandResult {
    bool ok = false;
    std::string message;
    std::string command_type;
    EventId event_id = 0;
};

SimCommandResult applyApproveCoa(WorldState& world, EventLedger& ledger, const ApproveCoaCommand& command);
SimCommandResult applyRejectCoa(WorldState& world, EventLedger& ledger, const RejectCoaCommand& command);
SimCommandResult applyManualIntervention(WorldState& world, EventLedger& ledger, const ManualInterventionCommand& command);

SimCommandResult processCommandJson(WorldState& world, EventLedger& ledger, const std::string& json_line);

} // namespace darla
