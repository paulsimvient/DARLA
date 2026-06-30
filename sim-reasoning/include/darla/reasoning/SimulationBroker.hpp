#pragma once

#include "darla/reasoning/EvidencePackage.hpp"

#include <functional>
#include <map>
#include <string>

namespace darla::reasoning {

enum class SimulationBackend {
    InternalKernel,
    Counterfactual,
    FMU,
    Distributed
};

struct SimulationRequest {
    std::string id;
    SimulationBackend backend = SimulationBackend::InternalKernel;
    std::string action_id;
    int start_tick = 0;
    int horizon_ticks = 0;
    std::map<std::string, double> numeric_inputs;
};

struct SimulationResult {
    std::string request_id;
    std::string action_id;
    bool ok = false;
    std::string outcome;
    double effect_delta = 0.0;
    std::string caveat;
};

class SimulationBroker {
public:
    using Executor = std::function<SimulationResult(const SimulationRequest&)>;

    void setInternalExecutor(Executor executor);
    void setCounterfactualExecutor(Executor executor);

    SimulationResult execute(const SimulationRequest& request) const;
    CounterfactualSummary executeCounterfactual(const SimulationRequest& request) const;

private:
    Executor internal_executor_;
    Executor counterfactual_executor_;
};

} // namespace darla::reasoning
