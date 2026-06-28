#pragma once

#include "sim-causal/InterventionEngine.h"

#include <string>
#include <vector>

namespace darla {

struct InterventionOption {
    Intervention intervention;
    double cost = 0.0;
    double risk = 0.0;
    double confidence = 0.0;
};

struct InterventionSetResult {
    std::vector<InterventionOption> options;
    CounterfactualResult result;
    double total_cost = 0.0;
    double total_risk = 0.0;
    double score = 0.0;
    bool effective = false;
};

struct MinimumInterventionSearchResult {
    std::vector<InterventionSetResult> ranked;
    InterventionSetResult lowest_cost_effective;
    InterventionSetResult best_effective;
    std::vector<InterventionSetResult> rejected;
};

class MinimumInterventionSearch {
public:
    MinimumInterventionSearchResult run(const Snapshot& snapshot, const MissionMetrics& baseline, Tick horizon_ticks) const;

private:
    std::vector<InterventionOption> defaultOptions() const;
    std::vector<InterventionOption> applicableOptions(const Snapshot& snapshot) const;
    InterventionSetResult evaluate(const Snapshot& snapshot, const MissionMetrics& baseline, Tick horizon_ticks, const std::vector<InterventionOption>& options) const;
};

std::string describeInterventionSet(const std::vector<InterventionOption>& options);

} // namespace darla
