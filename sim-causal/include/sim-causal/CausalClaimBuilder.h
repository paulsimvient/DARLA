#pragma once

#include "sim-causal/CausalClaim.h"
#include "sim-causal/CausalVariable.h"

#include "WorldState.h"
#include "sim-events/EventLedger.h"

namespace darla {

struct CounterfactualResult;
struct Snapshot;

class CausalClaimBuilder {
public:
    // Builds typed causal claims whose effect_size / confidence / status /
    // sensitivity_to_assumptions are *derived* from the structural causal model,
    // do-calculus identification, and an effect estimator -- never hardcoded.
    //
    // When `snapshot` is provided the estimator runs a seeded Monte-Carlo do()
    // ensemble; otherwise it falls back to the closed-form SCM contrast. Both paths
    // are derived from theta, so all call sites produce identification-consistent
    // numbers. `horizon_ticks` bounds the Monte-Carlo branch runs.
    static std::vector<CausalClaim> build(
        const EventLedger& ledger,
        const WorldState& world,
        const CounterfactualResult* result = nullptr,
        const Snapshot* snapshot = nullptr,
        Tick horizon_ticks = 0);
};

} // namespace darla
