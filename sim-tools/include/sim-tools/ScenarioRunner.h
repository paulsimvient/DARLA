#pragma once

#include "AgentAction.h"
#include "CourseOfAction.h"
#include "ScenarioLoader.h"
#include "ScriptRuntime.h"
#include "SimulationKernel.h"
#include "sim-causal/CausalActionEstimator.h"
#include "sim-credibility/AsyncValidationRuntime.h"
#include "sim-graph/RelationshipGraph.h"

#include <cstdint>
#include <filesystem>
#include <memory>
#include <optional>
#include <vector>

namespace darla {

struct ScenarioRunOptions {
    std::optional<std::uint64_t> seed_override;
    bool enable_realtime_agents = false;
    bool enable_python_scripts = true;
    AuthorizationMode authorization_mode = AuthorizationMode::PolicyAuto;
    std::vector<ApprovedCoa> approved_coas;
};

struct ScenarioRun {
    Scenario scenario;
    SimulationKernel kernel;
    Snapshot degradation_snapshot;
    bool has_degradation_snapshot = false;
    RelationshipGraph relationship_graph;
    CausalActionEstimator action_estimator;
    std::unique_ptr<ScriptRuntime> script_runtime;
    AsyncValidationRuntime async_validation;
    AsyncValidationSummary async_summary;
    bool has_async_summary = false;
};

ScenarioRun runScenarioFile(const std::filesystem::path& scenario_path, const ScenarioRunOptions& options);

ScenarioRun runScenarioFile(
    const std::filesystem::path& scenario_path,
    std::optional<std::uint64_t> seed_override,
    bool enable_realtime_agents = false);

ScenarioRunOptions parseScenarioRunOptions(int argc, char** argv, int start_index = 2);

void configureAgentRuntime(
    WorldState& world,
    const Scenario& scenario,
    RelationshipGraph& graph,
    CausalActionEstimator& estimator,
    bool enable_realtime_agents,
    AuthorizationMode authorization_mode = AuthorizationMode::PolicyAuto,
    const std::vector<ApprovedCoa>& approved_coas = {});

} // namespace darla
