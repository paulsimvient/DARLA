#include "darla/reasoning/BeliefState.hpp"
#include "darla/reasoning/EvidencePackage.hpp"
#include "darla/reasoning/MissionReasoner.hpp"
#include "darla/reasoning/SimulationBroker.hpp"

#include <cassert>
#include <string>

using namespace darla::reasoning;

int main() {
    BeliefState beliefs;
    beliefs.update(720, "sensor_agent", "sensor_degraded", 0.91, "cyber degradation observed");
    assert(beliefs.get("sensor_degraded") > 0.9);
    assert(beliefs.history().size() == 1);

    SimulationBroker broker;
    broker.setCounterfactualExecutor([](const SimulationRequest& request) {
        return SimulationResult{
            request.id,
            request.action_id,
            true,
            "mission_detection_recovers",
            request.action_id == "isolate_compromised_sensor_feed" ? 0.19 : 0.01,
            ""
        };
    });

    DecisionContext context;
    context.intent.mission_id = "uas-maritime-cyber-v001";
    context.intent.objective = "Detect and track red maritime target before cutoff";
    context.tick = 720;
    context.belief_state = beliefs;
    context.observations.push_back("UAS sensor confidence degraded after cyber event");
    context.causal_assumptions.push_back(
        CausalAssumption{"red_cyber_effect", "sensor_confidence", "degrades", 0.86});
    context.proposals.push_back(
        AgentProposal{
            "commander",
            CandidateAction{"isolate_compromised_sensor_feed", "Isolate compromised sensor feed", 0.18, 0.02, true},
            "Best causal recovery path"
        });
    context.replay_hash = 5825267991280241626ULL;

    MissionReasoner reasoner;
    const auto package = reasoner.reason(context, broker);

    assert(package.mission_id == "uas-maritime-cyber-v001");
    assert(package.selected_coa == "isolate_compromised_sensor_feed");
    assert(package.counterfactual_results.size() == 1);
    assert(package.confidence_score > 0.0);

    const auto json = to_json(package);
    assert(json.find("\"evidence_package\"") == std::string::npos);
    assert(json.find("\"selected_coa\":\"isolate_compromised_sensor_feed\"") != std::string::npos);

    return 0;
}
