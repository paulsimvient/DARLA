#pragma once

#include "ScenarioLoader.h"
#include "ScriptRuntime.h"
#include "Snapshot.h"
#include "sim-events/EventLedger.h"
#include "sim-graph/TemporalCausalGraph.h"

#include <cstdint>
#include <cstddef>
#include <random>

namespace darla {

class SimulationKernel {
public:
    void initialize(const SimConfig& config);
    void loadScenario(const Scenario& scenario);
    void step();
    void runUntil(Tick end_tick);
    Snapshot snapshot() const;
    void restore(const Snapshot& snapshot);
    void setScriptRuntime(ScriptRuntime* runtime);
    bool applyScriptCommand(const ScriptCommand& command, std::string* error = nullptr);

    const EventLedger& events() const { return ledger_; }
    EventLedger& events() { return ledger_; }
    const TemporalCausalGraph& causalGraph() const { return causal_graph_; }
    TemporalCausalGraph& causalGraph() { return causal_graph_; }
    const WorldState& world() const { return world_; }
    WorldState& world() { return world_; }
    const SimConfig& config() const { return config_; }

private:
    void notifyScriptsForNewEvents(std::size_t previous_event_count);

    SimConfig config_;
    WorldState world_;
    EventLedger ledger_;
    TemporalCausalGraph causal_graph_;
    std::mt19937_64 rng_;
    ScriptRuntime* script_runtime_ = nullptr;
};

} // namespace darla
