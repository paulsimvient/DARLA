#pragma once

#include "darla/reasoning/DecisionContext.hpp"
#include "darla/reasoning/EvidencePackage.hpp"
#include "darla/reasoning/SimulationBroker.hpp"

#include <optional>

namespace darla::reasoning {

struct MissionReasonerConfig {
    double minimum_supported_gain = 0.05;
    double high_confidence_threshold = 0.75;
    double medium_confidence_threshold = 0.45;
};

class MissionReasoner {
public:
    explicit MissionReasoner(MissionReasonerConfig config = {});

    EvidencePackage reason(
        const DecisionContext& context,
        const SimulationBroker& simulation_broker) const;

private:
    MissionReasonerConfig config_;

    std::optional<CandidateAction> selectBestAction(
        const std::vector<CandidateAction>& candidates,
        const std::vector<CounterfactualSummary>& counterfactuals) const;

    double confidenceFor(
        const CandidateAction& action,
        const std::vector<CounterfactualSummary>& counterfactuals,
        const DecisionContext& context) const;
};

} // namespace darla::reasoning
