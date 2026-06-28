#pragma once

#include "CourseOfAction.h"
#include "WorldState.h"
#include "sim-events/EventLedger.h"
#include "sim-graph/TemporalCausalGraph.h"

#include <string>
#include <vector>

namespace darla {

struct FrameBuildOptions {
    bool include_budgets = false;
    std::string run_id;
    std::string branch_id = "baseline";
    std::string parent_run_id;
    std::uint64_t replay_hash = 0;
};

std::string buildSimFrameJson(
    Tick tick,
    const WorldState& world,
    const std::vector<const SimEvent*>& tick_events,
    const TemporalCausalGraph* causal_graph = nullptr,
    const FrameBuildOptions& options = {});

std::string buildRunMetaJson(
    const std::string& scenario_id,
    std::uint64_t seed,
    AuthorizationMode authorization_mode,
    Tick max_ticks,
    double tick_seconds,
    Tick mission_cutoff,
    const FrameBuildOptions& options = {});

void writeCoaLogJson(std::ostringstream& out, const std::vector<CourseOfAction>& coa_log);

} // namespace darla
