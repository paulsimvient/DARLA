#pragma once

#include "RelationshipTypes.h"
#include "sim-events/SimEvent.h"

#include <string>
#include <vector>

namespace darla {

struct RuntimeCausalEdgeEvidence {
    std::string cause;
    std::string effect;
    double temporal_precedence = 0.0;
    double state_delta_support = 0.0;
    double intervention_contrast = 0.0;
    double counterfactual_support = 0.0;
    double relationship_prior = 0.0;
    double falsification_survival = 0.0;
    double confounding_penalty = 0.0;
    double total_score = 0.0;
    std::vector<EventId> supporting_event_ids;
    std::string explanation;
};

struct RuntimeHypothesisGraph {
    std::vector<RuntimeCausalEdgeEvidence> edges;
};

struct RuntimeHypothesisConfig {
    double accept_threshold = 0.65;
    bool allow_domain_priors = true;
    bool allow_planted_truth = false;
};

RuntimeHypothesisGraph buildRuntimeHypothesisGraph(
    const std::vector<SimEvent>& events,
    const RuntimeHypothesisConfig& config = {});

std::string inferCausalVariable(const SimEvent& event);

} // namespace darla
