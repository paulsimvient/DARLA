#include "sim-agents/AuthorityGate.h"
#include "sim-agents/Agents.h"

namespace darla {

AuthorityDecision evaluateAuthority(
    const WorldState& world,
    const CandidateAction& candidate,
    Tick scheduled_at_tick) {
    AuthorityDecision result;
    result.effective_authority = AgentAuthority::Recommend;

    if (candidate.type == ActionType::HoldCurrentCOA) {
        result.reason = "hold current COA — no authorization requested";
        return result;
    }

    switch (world.authorization_mode) {
    case AuthorizationMode::HumanHold:
        result.reason = "human hold — recommendations only";
        return result;
    case AuthorizationMode::ExplicitApprovals:
        for (const auto& approved : world.approved_coas) {
            if (approved.action == candidate.type && approved.at_tick == scheduled_at_tick) {
                result.approved = true;
                result.reason = "explicit approval matched";
                result.effective_authority = AgentAuthority::Act;
                return result;
            }
        }
        result.reason = "awaiting explicit approval";
        return result;
    case AuthorizationMode::PolicyAuto:
        if (candidate.supported && candidate.expectedMissionGain > 0.05) {
            result.approved = true;
            result.reason = "policy auto-approved supported COA";
            result.effective_authority = AgentAuthority::Act;
            return result;
        }
        result.reason = "policy thresholds not met";
        return result;
    }
    return result;
}

} // namespace darla
