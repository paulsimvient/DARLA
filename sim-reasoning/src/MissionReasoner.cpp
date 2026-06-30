#include "darla/reasoning/MissionReasoner.hpp"

#include <algorithm>
#include <cmath>
#include <numeric>

namespace darla::reasoning {

MissionReasoner::MissionReasoner(MissionReasonerConfig config)
    : config_(config) {}

EvidencePackage MissionReasoner::reason(
    const DecisionContext& context,
    const SimulationBroker& simulation_broker) const {

    EvidencePackage package;
    package.mission_id = context.intent.mission_id;
    package.tick = context.tick;
    package.observations = context.observations;
    package.causal_assumptions = context.causal_assumptions;
    package.replay_hash = context.replay_hash;

    for (const auto& proposal : context.proposals) {
        package.candidate_actions.push_back(proposal.action);

        SimulationRequest request;
        request.id = "cf_" + proposal.action.id + "_" + std::to_string(context.tick);
        request.backend = SimulationBackend::Counterfactual;
        request.action_id = proposal.action.id;
        request.start_tick = context.tick;
        request.horizon_ticks = 600;

        package.counterfactual_results.push_back(
            simulation_broker.executeCounterfactual(request));
    }

    const auto selected = selectBestAction(
        package.candidate_actions,
        package.counterfactual_results);

    if (!selected.has_value()) {
        package.selected_coa = "hold";
        package.confidence_score = 0.0;
        package.confidence_band = ConfidenceBand::Low;
        package.caveats.push_back("No candidate action cleared causal support threshold.");
        return package;
    }

    package.selected_coa = selected->id;
    package.confidence_score = confidenceFor(
        *selected,
        package.counterfactual_results,
        context);
    package.confidence_band = confidence_band_from_score(package.confidence_score);

    if (package.confidence_band == ConfidenceBand::Low) {
        package.caveats.push_back("Recommendation confidence is low; human review required.");
    }
    if (selected->authority_required) {
        package.caveats.push_back("Selected action requires explicit authority.");
    }

    return package;
}

std::optional<CandidateAction> MissionReasoner::selectBestAction(
    const std::vector<CandidateAction>& candidates,
    const std::vector<CounterfactualSummary>& counterfactuals) const {

    std::optional<CandidateAction> best;
    double best_score = config_.minimum_supported_gain;

    for (const auto& action : candidates) {
        const auto cf = std::find_if(
            counterfactuals.begin(),
            counterfactuals.end(),
            [&](const CounterfactualSummary& r) {
                return r.action_id == action.id;
            });

        const double causal_gain =
            cf == counterfactuals.end() ? action.expected_gain : cf->effect_delta;

        const double score = causal_gain - action.risk;
        if (score > best_score) {
            best = action;
            best_score = score;
        }
    }

    return best;
}

double MissionReasoner::confidenceFor(
    const CandidateAction& action,
    const std::vector<CounterfactualSummary>& counterfactuals,
    const DecisionContext& context) const {

    const auto cf = std::find_if(
        counterfactuals.begin(),
        counterfactuals.end(),
        [&](const CounterfactualSummary& r) {
            return r.action_id == action.id;
        });

    const double support = cf == counterfactuals.end()
        ? action.expected_gain
        : std::max(0.0, cf->effect_delta);

    const double causal_prior = context.causal_assumptions.empty()
        ? 0.5
        : std::accumulate(
            context.causal_assumptions.begin(),
            context.causal_assumptions.end(),
            0.0,
            [](double acc, const CausalAssumption& a) { return acc + a.confidence; })
          / static_cast<double>(context.causal_assumptions.size());

    const double risk_penalty = std::min(0.4, std::max(0.0, action.risk));
    const double raw = (0.55 * support) + (0.45 * causal_prior) - risk_penalty;
    return std::clamp(raw, 0.0, 1.0);
}

} // namespace darla::reasoning
