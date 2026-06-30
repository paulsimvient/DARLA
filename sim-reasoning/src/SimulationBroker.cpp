#include "darla/reasoning/SimulationBroker.hpp"

namespace darla::reasoning {

void SimulationBroker::setInternalExecutor(Executor executor) {
    internal_executor_ = std::move(executor);
}

void SimulationBroker::setCounterfactualExecutor(Executor executor) {
    counterfactual_executor_ = std::move(executor);
}

SimulationResult SimulationBroker::execute(const SimulationRequest& request) const {
    if (request.backend == SimulationBackend::Counterfactual && counterfactual_executor_) {
        return counterfactual_executor_(request);
    }
    if (internal_executor_) {
        return internal_executor_(request);
    }

    return SimulationResult{
        request.id,
        request.action_id,
        false,
        "no_executor_available",
        0.0,
        "SimulationBroker has no executor for requested backend"
    };
}

CounterfactualSummary SimulationBroker::executeCounterfactual(const SimulationRequest& request) const {
    const auto result = execute(request);
    return CounterfactualSummary{
        request.action_id,
        "baseline",
        result.outcome,
        result.effect_delta,
        result.ok && result.effect_delta > 0.0
    };
}

} // namespace darla::reasoning
