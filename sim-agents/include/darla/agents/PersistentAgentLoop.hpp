#pragma once

#include "darla/reasoning/BeliefState.hpp"
#include "darla/reasoning/DecisionContext.hpp"

#include <string>
#include <vector>

namespace darla::agents {

struct AgentObservation {
    int tick = 0;
    std::string key;
    double value = 0.0;
    std::string description;
};

class PersistentAgent {
public:
    virtual ~PersistentAgent() = default;

    virtual std::string id() const = 0;

    virtual std::vector<AgentObservation> sense(int tick) = 0;

    virtual void updateBeliefs(
        int tick,
        const std::vector<AgentObservation>& observations,
        darla::reasoning::BeliefState& belief_state) = 0;

    virtual std::vector<darla::reasoning::AgentProposal> evaluate(
        int tick,
        const darla::reasoning::BeliefState& belief_state) = 0;

    std::vector<darla::reasoning::AgentProposal> step(
        int tick,
        darla::reasoning::BeliefState& belief_state) {
        auto observations = sense(tick);
        updateBeliefs(tick, observations, belief_state);
        return evaluate(tick, belief_state);
    }
};

} // namespace darla::agents
