#include "sim-causal/MinimumInterventionSearch.h"

#include "InterventionPreconditions.h"

#include <algorithm>
#include <sstream>

namespace darla {

std::string describeInterventionSet(const std::vector<InterventionOption>& options) {
    std::ostringstream out;
    for (std::size_t i = 0; i < options.size(); ++i) {
        if (i > 0) out << " + ";
        out << toString(options[i].intervention.type);
    }
    return out.str();
}

std::vector<InterventionOption> MinimumInterventionSearch::defaultOptions() const {
    return {
        InterventionOption{Intervention{InterventionType::IsolateCompromisedSensorFeed, 760, "blue_uas_1"}, 0.03, 0.05, 0.82},
        InterventionOption{Intervention{InterventionType::RestoreCommsRelay, 760, "blue_relay_1"}, 0.04, 0.04, 0.48},
        InterventionOption{Intervention{InterventionType::EnableAutonomousSearch, 900, "blue_uas_1"}, 0.08, 0.12, 0.62},
        InterventionOption{Intervention{InterventionType::PreAuthorizeEngagement, 900, "blue_commander"}, 0.02, 0.18, 0.45},
    };
}

std::vector<InterventionOption> MinimumInterventionSearch::applicableOptions(const Snapshot& snapshot) const {
    std::vector<InterventionOption> options;
    for (const auto& option : defaultOptions()) {
        const auto* target = snapshot.world.entityByName(option.intervention.target);
        if (evaluateInterventionPrecondition(snapshot.world, toString(option.intervention.type), target).applies) {
            options.push_back(option);
        }
    }
    return options;
}

InterventionSetResult MinimumInterventionSearch::evaluate(
    const Snapshot& snapshot,
    const MissionMetrics& baseline,
    Tick horizon_ticks,
    const std::vector<InterventionOption>& options) const {
    std::vector<Intervention> interventions;
    InterventionSetResult set;
    set.options = options;
    for (const auto& option : options) {
        interventions.push_back(option.intervention);
        set.total_cost += option.cost;
        set.total_risk += option.risk;
    }

    InterventionEngine engine;
    set.result = engine.run(snapshot, baseline, interventions, horizon_ticks);
    set.effective = set.result.counterfactual.mission_success && set.result.estimated_effect > 0.05;
    set.score = set.result.estimated_effect - set.total_cost - set.total_risk;
    return set;
}

MinimumInterventionSearchResult MinimumInterventionSearch::run(const Snapshot& snapshot, const MissionMetrics& baseline, Tick horizon_ticks) const {
    const auto options = applicableOptions(snapshot);
    MinimumInterventionSearchResult search;

    for (std::size_t i = 0; i < options.size(); ++i) {
        search.ranked.push_back(evaluate(snapshot, baseline, horizon_ticks, {options[i]}));
    }
    for (std::size_t i = 0; i < options.size(); ++i) {
        for (std::size_t j = i + 1; j < options.size(); ++j) {
            search.ranked.push_back(evaluate(snapshot, baseline, horizon_ticks, {options[i], options[j]}));
        }
    }

    std::sort(search.ranked.begin(), search.ranked.end(), [](const InterventionSetResult& lhs, const InterventionSetResult& rhs) {
        if (lhs.effective != rhs.effective) return lhs.effective > rhs.effective;
        if (lhs.options.size() != rhs.options.size()) return lhs.options.size() < rhs.options.size();
        return lhs.score > rhs.score;
    });

    bool have_lowest = false;
    bool have_best = false;
    for (const auto& result : search.ranked) {
        if (!result.effective) {
            search.rejected.push_back(result);
            continue;
        }
        if (!have_lowest ||
            result.options.size() < search.lowest_cost_effective.options.size() ||
            (result.options.size() == search.lowest_cost_effective.options.size() && result.total_cost < search.lowest_cost_effective.total_cost)) {
            search.lowest_cost_effective = result;
            have_lowest = true;
        }
        if (!have_best || result.result.counterfactual.mission_success_score > search.best_effective.result.counterfactual.mission_success_score) {
            search.best_effective = result;
            have_best = true;
        }
    }

    return search;
}

} // namespace darla
