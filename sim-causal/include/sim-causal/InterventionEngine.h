#pragma once

#include "SimulationKernel.h"
#include "sim-causal/CausalClaim.h"

#include <string>
#include <vector>

namespace darla {

enum class InterventionType {
    IsolateCompromisedSensorFeed,
    RestoreCommsRelay,
    RemoveLogisticsDelay,
    EnableAutonomousSearch,
    PreAuthorizeEngagement
};

struct Intervention {
    InterventionType type = InterventionType::IsolateCompromisedSensorFeed;
    Tick at_tick = 0;
    std::string target = "blue_uas_1";
};

struct CounterfactualResult {
    MissionMetrics baseline;
    MissionMetrics counterfactual;
    double estimated_effect = 0.0;
    std::string confidence;
    std::string validity;
    std::vector<std::string> dominant_causal_path;
    std::vector<CausalClaim> claims;
    EventLedger branch_ledger;
};

class InterventionEngine {
public:
    CounterfactualResult run(const Snapshot& snapshot, const MissionMetrics& baseline, const Intervention& intervention, Tick horizon_ticks) const;
    CounterfactualResult run(const Snapshot& snapshot, const MissionMetrics& baseline, const std::vector<Intervention>& interventions, Tick horizon_ticks) const;
    static std::vector<CausalClaim> buildClaims(const EventLedger& ledger, const WorldState& world, const CounterfactualResult* result = nullptr);
};

std::string toString(InterventionType type);

} // namespace darla
