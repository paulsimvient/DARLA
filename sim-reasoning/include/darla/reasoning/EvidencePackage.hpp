#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace darla::reasoning {

enum class ConfidenceBand {
    Low,
    Medium,
    High
};

struct CausalAssumption {
    std::string source;
    std::string target;
    std::string relation;
    double confidence = 0.0;
};

struct CandidateAction {
    std::string id;
    std::string label;
    double expected_gain = 0.0;
    double risk = 0.0;
    bool authority_required = false;
};

struct CounterfactualSummary {
    std::string action_id;
    std::string baseline_outcome;
    std::string intervention_outcome;
    double effect_delta = 0.0;
    bool supports_action = false;
};

struct EvidencePackage {
    std::string mission_id;
    int tick = 0;

    std::vector<std::string> observations;
    std::vector<CausalAssumption> causal_assumptions;
    std::vector<CandidateAction> candidate_actions;
    std::vector<CounterfactualSummary> counterfactual_results;

    std::string selected_coa;
    double confidence_score = 0.0;
    ConfidenceBand confidence_band = ConfidenceBand::Low;
    std::vector<std::string> caveats;
    std::uint64_t replay_hash = 0;
};

std::string to_string(ConfidenceBand band);
ConfidenceBand confidence_band_from_score(double score);
std::string to_json(const EvidencePackage& package);

} // namespace darla::reasoning
