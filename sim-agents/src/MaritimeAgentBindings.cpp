#include "sim-agents/AgentFramework.h"
#include "sim-agents/Agents.h"

namespace darla {
namespace {

class RedCyberAgentBinding : public SimulationAgent {
public:
    std::string id() const override { return "red_cyber_actor"; }
    std::string displayName() const override { return "RedCyberAgent"; }
    AgentPhase phase() const override { return AgentPhase::PreCyber; }
    AgentAuthority authority() const override { return AgentAuthority::Act; }
    int priority() const override { return 10; }

    AgentTickResult tick(AgentContext& ctx) override {
        RedCyberAgent{}.step(ctx.world, ctx.ledger, *ctx.relationships);
        return {.sensed = true, .summary = "red cyber posture and attack window"};
    }
};

class SensorAgentBinding : public SimulationAgent {
public:
    std::string id() const override { return "blue_uas_1.sensor"; }
    std::string displayName() const override { return "SensorAgent"; }
    AgentPhase phase() const override { return AgentPhase::PostCyber; }
    AgentAuthority authority() const override { return AgentAuthority::Observe; }
    int priority() const override { return 10; }

    AgentTickResult tick(AgentContext& ctx) override {
        const auto before = ctx.world.agent_beliefs.sensor;
        SensorAgent{}.step(ctx.world, ctx.ledger);
        const auto& after = ctx.world.agent_beliefs.sensor;
        AgentTickResult result{.sensed = after.last_sense_tick == ctx.world.tick, .summary = "sensor trust monitoring"};
        if (after.last_monitoring_tick != before.last_monitoring_tick) {
            result.monitoring_emitted = true;
        }
        if (after.anomaly_active && !before.anomaly_active) {
            result.anomaly_detected = true;
        }
        return result;
    }
};

class CommsAgentBinding : public SimulationAgent {
public:
    std::string id() const override { return "blue_relay_1.comms"; }
    std::string displayName() const override { return "CommsAgent"; }
    AgentPhase phase() const override { return AgentPhase::PostCyber; }
    AgentAuthority authority() const override { return AgentAuthority::Observe; }
    int priority() const override { return 20; }

    AgentTickResult tick(AgentContext& ctx) override {
        const auto before = ctx.world.agent_beliefs.comms;
        CommsAgent{}.step(ctx.world, ctx.ledger);
        const auto& after = ctx.world.agent_beliefs.comms;
        AgentTickResult result{.sensed = after.last_sense_tick == ctx.world.tick, .summary = "relay health monitoring"};
        if (after.last_monitoring_tick != before.last_monitoring_tick) {
            result.monitoring_emitted = true;
        }
        if (after.anomaly_active && !before.anomaly_active) {
            result.anomaly_detected = true;
        }
        return result;
    }
};

class BlueUASAgentBinding : public SimulationAgent {
public:
    std::string id() const override { return "blue_uas_1"; }
    std::string displayName() const override { return "BlueUASAgent"; }
    AgentPhase phase() const override { return AgentPhase::PostCyber; }
    AgentAuthority authority() const override { return AgentAuthority::Observe; }
    int priority() const override { return 30; }

    AgentTickResult tick(AgentContext& ctx) override {
        const auto before = ctx.world.agent_beliefs.uas;
        BlueUASAgent{}.step(ctx.world, ctx.ledger);
        const auto& after = ctx.world.agent_beliefs.uas;
        AgentTickResult result{.sensed = after.last_sense_tick == ctx.world.tick, .summary = "platform search monitoring"};
        if (after.last_monitoring_tick != before.last_monitoring_tick) {
            result.monitoring_emitted = true;
        }
        if (after.anomaly_active && !before.anomaly_active) {
            result.anomaly_detected = true;
        }
        return result;
    }
};

class LogisticsAgentBinding : public SimulationAgent {
public:
    std::string id() const override { return "logistics_support_node"; }
    std::string displayName() const override { return "LogisticsAgent"; }
    AgentPhase phase() const override { return AgentPhase::PostCyber; }
    AgentAuthority authority() const override { return AgentAuthority::Observe; }
    int priority() const override { return 40; }

    AgentTickResult tick(AgentContext& ctx) override {
        const auto before = ctx.world.agent_beliefs.logistics;
        LogisticsAgent{}.step(ctx.world, ctx.ledger);
        const auto& after = ctx.world.agent_beliefs.logistics;
        AgentTickResult result{.sensed = after.last_sense_tick == ctx.world.tick, .summary = "supply chain monitoring"};
        if (after.last_monitoring_tick != before.last_monitoring_tick) {
            result.monitoring_emitted = true;
        }
        return result;
    }
};

class CausalMonitorAgentBinding : public SimulationAgent {
public:
    std::string id() const override { return "causal_monitor"; }
    std::string displayName() const override { return "CausalMonitorAgent"; }
    AgentPhase phase() const override { return AgentPhase::PostCyber; }
    AgentAuthority authority() const override { return AgentAuthority::Recommend; }
    int priority() const override { return 50; }

    AgentTickResult tick(AgentContext& ctx) override {
        const bool warning_before = ctx.world.agent_beliefs.causal_monitor.emergence_warning;
        CausalMonitorAgent{}.step(ctx.world, ctx.ledger);
        AgentTickResult result{.sensed = true, .summary = "causal path scan"};
        if (ctx.world.agent_beliefs.causal_monitor.emergence_warning && !warning_before) {
            result.anomaly_detected = true;
        }
        return result;
    }
};

class CredibilityAgentBinding : public SimulationAgent {
public:
    std::string id() const override { return "credibility_agent"; }
    std::string displayName() const override { return "CredibilityAgent"; }
    AgentPhase phase() const override { return AgentPhase::PostCyber; }
    AgentAuthority authority() const override { return AgentAuthority::Recommend; }
    int priority() const override { return 60; }

    AgentTickResult tick(AgentContext& ctx) override {
        const bool valid_before = ctx.world.agent_beliefs.credibility.validity_ok;
        CredibilityAgent{}.step(ctx.world, ctx.ledger);
        AgentTickResult result{.sensed = true, .summary = "credibility envelope check"};
        if (!ctx.world.agent_beliefs.credibility.validity_ok && valid_before) {
            result.anomaly_detected = true;
        }
        return result;
    }
};

class BlueCommanderAgentBinding : public SimulationAgent {
public:
    std::string id() const override { return "blue_commander"; }
    std::string displayName() const override { return "BlueCommanderAgent"; }
    AgentPhase phase() const override { return AgentPhase::PostCyber; }
    AgentAuthority authority() const override { return AgentAuthority::Recommend; }
    int priority() const override { return 100; }

    AgentTickResult tick(AgentContext& ctx) override {
        const bool decided_before = ctx.world.agent_beliefs.commander.primary_decision_recorded;
        const std::size_t coa_events_before = countEventsWithLabel(ctx.ledger, "coa_recommendation");
        BlueCommanderAgent{}.step(ctx.world, ctx.ledger, *ctx.causal_graph, *ctx.relationships, *ctx.estimator);
        AgentTickResult result{.sensed = true, .summary = "mission risk evaluation and COA review"};
        if (ctx.world.agent_beliefs.commander.last_monitoring_tick == ctx.world.tick) {
            result.monitoring_emitted = true;
        }
        if (countEventsWithLabel(ctx.ledger, "coa_recommendation") > coa_events_before) {
            result.action_proposed = true;
            result.summary = "ranked COA recommendation emitted";
        }
        if (!decided_before && ctx.world.agent_beliefs.commander.primary_decision_recorded) {
            result.action_applied = true;
            result.summary = "authority-gated intervention scheduled";
        }
        return result;
    }

private:
    static std::size_t countEventsWithLabel(const EventLedger& ledger, const std::string& label) {
        std::size_t count = 0;
        for (const auto& event : ledger.events()) {
            if (event.label == label) ++count;
        }
        return count;
    }
};

} // namespace

void registerMaritimeMicroWorldAgents(AgentRegistry& registry) {
    registry.registerAgent(std::make_unique<RedCyberAgentBinding>());
    registry.registerAgent(std::make_unique<SensorAgentBinding>());
    registry.registerAgent(std::make_unique<CommsAgentBinding>());
    registry.registerAgent(std::make_unique<BlueUASAgentBinding>());
    registry.registerAgent(std::make_unique<LogisticsAgentBinding>());
    registry.registerAgent(std::make_unique<CausalMonitorAgentBinding>());
    registry.registerAgent(std::make_unique<CredibilityAgentBinding>());
    registry.registerAgent(std::make_unique<BlueCommanderAgentBinding>());
}

AgentOrchestrator createMaritimeAgentOrchestrator() {
    AgentRegistry registry;
    registerMaritimeMicroWorldAgents(registry);
    return AgentOrchestrator(std::move(registry));
}

} // namespace darla
