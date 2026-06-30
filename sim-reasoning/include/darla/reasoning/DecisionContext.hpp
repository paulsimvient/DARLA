#pragma once

#include "darla/reasoning/BeliefState.hpp"
#include "darla/reasoning/EvidencePackage.hpp"

#include <string>
#include <vector>

namespace darla::reasoning {

struct MissionIntent {
    std::string mission_id;
    std::string objective;
    std::vector<std::string> constraints;
    std::vector<std::string> assumptions;
};

struct AgentProposal {
    std::string agent_id;
    CandidateAction action;
    std::string rationale;
};

struct DecisionContext {
    MissionIntent intent;
    int tick = 0;
    BeliefState belief_state;
    std::vector<std::string> observations;
    std::vector<CausalAssumption> causal_assumptions;
    std::vector<AgentProposal> proposals;
    std::uint64_t replay_hash = 0;
};

} // namespace darla::reasoning
