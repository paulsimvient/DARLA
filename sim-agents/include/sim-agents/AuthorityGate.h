#pragma once

#include "CourseOfAction.h"
#include "WorldState.h"
#include "sim-agents/AgentFramework.h"
#include "sim-agents/Agents.h"

namespace darla {

struct AuthorityDecision {
    bool approved = false;
    std::string reason;
    AgentAuthority effective_authority = AgentAuthority::Recommend;
};

AuthorityDecision evaluateAuthority(
    const WorldState& world,
    const CandidateAction& candidate,
    Tick scheduled_at_tick);

} // namespace darla
