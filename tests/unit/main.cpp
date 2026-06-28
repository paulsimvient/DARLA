#include "ScenarioLoader.h"
#include "SimulationKernel.h"
#include "InterventionPreconditions.h"
#include "sim-agents/AgentRuntime.h"
#include "sim-agents/Agents.h"
#include "sim-causal/CausalActionEstimator.h"
#include "DecisionHorizon.h"
#include "StructuralCausalModel.h"
#include "sim-causal/CausalClaimBuilder.h"
#include "sim-causal/CausalEffectEstimator.h"
#include "sim-causal/CalibrationHarness.h"
#include "sim-causal/Identification.h"
#include "sim-causal/InterventionEngine.h"
#include "sim-credibility/CredibilityContractLoader.h"
#include "sim-credibility/CredibilityEngine.h"
#include "sim-adjudication/EmergenceDetector.h"
#include "sim-causal/PlantedTruthScorer.h"
#include "sim-graph/RelationshipGraph.h"
#include "sim-graph/GraphEntityResolver.h"
#include "sim-tools/ScenarioRunner.h"
#include "sim-tools/SimCommandProcessor.h"

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <filesystem>
#include <iostream>
#include <string>

using namespace darla;

namespace {

Scenario loadScenario() {
    ScenarioLoader loader;
    return loader.load(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/scenario.yaml");
}

SimulationKernel runScenario(const Scenario& scenario, Snapshot* degradation_snapshot = nullptr, bool enable_realtime_agents = false) {
    RelationshipGraph graph;
    CausalActionEstimator estimator;
    SimulationKernel kernel;
    kernel.loadScenario(scenario);
    configureAgentRuntime(kernel.world(), scenario, graph, estimator, enable_realtime_agents);
    bool captured = false;
    while (kernel.world().tick < scenario.config.max_ticks) {
        kernel.step();
        if (degradation_snapshot && !captured && kernel.world().cyber_degradation_applied) {
            *degradation_snapshot = kernel.snapshot();
            captured = true;
        }
    }
    return kernel;
}

void require(bool condition, const std::string& message) {
    if (!condition) {
        std::cerr << "FAIL: " << message << '\n';
        std::exit(1);
    }
}

EntityId entityIdFor(const WorldState& world, const std::string& name) {
    const auto* entity = world.entityByName(name);
    return entity ? entity->id : 0;
}

void deterministicReplayHashMatches() {
    const auto scenario = loadScenario();
    const auto a = runScenario(scenario);
    const auto b = runScenario(scenario);
    require(a.events().stableHash() == b.events().stableHash(), "deterministic replay hash mismatch");
    require(a.world().metrics.detection_time == b.world().metrics.detection_time, "detection time mismatch");
}

void taiwanOpenDataScenarioLoads() {
    ScenarioLoader loader;
    const auto scenario = loader.load(
        std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/taiwan-maritime-open-data/scenario.yaml");
    require(scenario.config.scenario_id == "taiwan-maritime-open-data-v001", "taiwan scenario id mismatch");
    require(scenario.open_data.data_mode == "open_data_snapshot", "taiwan open data mode mismatch");
    require(scenario.ais_tracks.size() == 3, "taiwan AIS track count mismatch");
    require(scenario.environment.weather_source == "open-meteo", "taiwan weather source mismatch");
}

void taiwanOpenDataDeterministicReplayMatchesGolden() {
    ScenarioLoader loader;
    const auto baseline = loader.load(
        std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/scenario.yaml");
    const auto taiwan = loader.load(
        std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/taiwan-maritime-open-data/scenario.yaml");
    const auto baseline_run = runScenario(baseline);
    const auto taiwan_a = runScenario(taiwan);
    const auto taiwan_b = runScenario(taiwan);
    require(taiwan_a.events().stableHash() == taiwan_b.events().stableHash(), "taiwan deterministic replay hash mismatch");
    require(taiwan_a.world().metrics.detection_time == 1980, "taiwan detection time mismatch");
    require(
        taiwan_a.events().stableHash() == baseline_run.events().stableHash(),
        "taiwan replay hash should match uas-maritime-cyber baseline");
}

void ledgerIntegrityHolds() {
    const auto scenario = loadScenario();
    const auto kernel = runScenario(scenario);
    std::string error;
    require(kernel.events().validateIntegrity(&error), "ledger integrity failed: " + error);
    require(kernel.events().size() >= 7, "expected core evidence events");
}

void counterfactualImprovesMissionScore() {
    const auto scenario = loadScenario();
    Snapshot snapshot;
    const auto baseline = runScenario(scenario, &snapshot);
    InterventionEngine engine;
    const auto result = engine.run(snapshot, baseline.world().metrics, Intervention{InterventionType::IsolateCompromisedSensorFeed, 760, "blue_uas_1"}, scenario.config.max_ticks);
    require(result.counterfactual.detection_time < baseline.world().metrics.detection_time, "counterfactual should detect earlier");
    require(result.estimated_effect > 0.10, "counterfactual mission score delta too small");
    require(result.counterfactual.mission_success, "counterfactual should recover mission success");
}

void interventionTimingIsCausal() {
    const auto scenario = loadScenario();
    Snapshot snapshot;
    const auto baseline = runScenario(scenario, &snapshot);
    InterventionEngine engine;

    const auto early = engine.run(snapshot, baseline.world().metrics, Intervention{InterventionType::IsolateCompromisedSensorFeed, 760, "blue_uas_1"}, scenario.config.max_ticks);
    const auto partial = engine.run(snapshot, baseline.world().metrics, Intervention{InterventionType::IsolateCompromisedSensorFeed, 1700, "blue_uas_1"}, scenario.config.max_ticks);
    const auto late = engine.run(snapshot, baseline.world().metrics, Intervention{InterventionType::IsolateCompromisedSensorFeed, 2000, "blue_uas_1"}, scenario.config.max_ticks);
    const auto post_failure = engine.run(snapshot, baseline.world().metrics, Intervention{InterventionType::IsolateCompromisedSensorFeed, 3000, "blue_uas_1"}, scenario.config.max_ticks);

    require(early.counterfactual.detection_time == 1440, "early intervention should recover earliest branch detection");
    require(partial.counterfactual.detection_time == 1700, "partial intervention should detect when intervention arrives after earliest recovery time");
    require(late.counterfactual.detection_time == baseline.world().metrics.detection_time, "late intervention cannot change past detection");
    require(!late.counterfactual.mission_success, "late intervention should not recover failed mission timing");
    require(post_failure.counterfactual.detection_time == baseline.world().metrics.detection_time, "post-failure intervention cannot rewrite detection");
    require(!post_failure.counterfactual.mission_success, "post-failure intervention cannot recover mission");
}

void exportedLedgerHashMatchesBody() {
    const auto scenario = loadScenario();
    const auto kernel = runScenario(scenario);
    const auto exported = kernel.events().serializeWithHeader();
    const auto newline = exported.find('\n');
    require(newline != std::string::npos, "exported ledger missing header newline");
    const auto header = exported.substr(0, newline);
    const auto body = exported.substr(newline + 1);
    require(header.find("DARLA_EVENT_LEDGER_V1 hash=") == 0, "exported ledger missing versioned header");
    require(EventLedger::stableHashForSerialized(body) == kernel.events().stableHash(), "exported ledger hash does not match body");
}

void sharedScenarioRunnerCapturesSnapshot() {
    const auto run = runScenarioFile(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/scenario.yaml", 42);
    require(run.has_degradation_snapshot, "shared runner did not capture degradation snapshot");
    require(run.kernel.world().metrics.detection_time == 1980, "shared runner produced unexpected detection time");
}

void ledgerRejectsTemporalRegression() {
    EventLedger ledger;
    ledger.append(SimEvent{0, 10, 1, EventType::Observe, {}, {}, {}, {}, 1.0, 0.0, 0.0, "test", "unit", "later"});
    ledger.append(SimEvent{0, 9, 1, EventType::Observe, {}, {}, {}, {}, 1.0, 0.0, 0.0, "test", "unit", "earlier"});
    std::string error;
    require(!ledger.validateIntegrity(&error), "ledger should reject non-monotonic event ticks");
    require(error == "non-monotonic event tick", "ledger reported unexpected temporal error");
}

void credibilityAssessmentsRejectFalseCause() {
    const auto scenario = loadScenario();
    Snapshot snapshot;
    const auto kernel = runScenario(scenario, &snapshot);
    const auto claims = InterventionEngine::buildClaims(kernel.events(), kernel.world());
    CredibilityEngine engine(std::filesystem::path(DARLA_SOURCE_DIR) / "models");
    const auto assessments = engine.assessClaims(claims, kernel.events(), snapshot, kernel.world().metrics, scenario.config.max_ticks);

    bool found_reportable_sensor_claim = false;
    bool found_rejected_logistics_claim = false;
    bool found_executed_branches = false;
    for (const auto& assessment : assessments) {
        if (assessment.claim.label == "sensor_confidence_loss -> delayed_detection") {
            found_reportable_sensor_claim = assessment.reportable && assessment.falsification.survived;
            found_executed_branches = assessment.falsification.branch_outcomes.size() >= 3;
        }
        if (assessment.claim.label == "logistics_delay -> mission_failure rejected") {
            found_rejected_logistics_claim = assessment.reportable && assessment.falsification.overturned;
        }
    }

    require(found_reportable_sensor_claim, "credible sensor causal claim was not reportable");
    require(found_rejected_logistics_claim, "false logistics cause was not overturned");
    require(found_executed_branches, "falsification did not execute branch experiments");
}

void falsificationBranchesTestAlternates() {
    const auto scenario = loadScenario();
    Snapshot snapshot;
    const auto baseline = runScenario(scenario, &snapshot);
    InterventionEngine engine;
    const auto restore_comms = engine.run(snapshot, baseline.world().metrics, Intervention{InterventionType::RestoreCommsRelay, 760, "blue_relay_1"}, scenario.config.max_ticks);
    const auto remove_logistics = engine.run(snapshot, baseline.world().metrics, Intervention{InterventionType::RemoveLogisticsDelay, 760, "logistics_support_node"}, scenario.config.max_ticks);
    const auto autonomous_search = engine.run(snapshot, baseline.world().metrics, Intervention{InterventionType::EnableAutonomousSearch, 760, "blue_uas_1"}, scenario.config.max_ticks);
    const auto pre_authorize = engine.run(snapshot, baseline.world().metrics, Intervention{InterventionType::PreAuthorizeEngagement, 760, "blue_commander"}, scenario.config.max_ticks);

    require(restore_comms.counterfactual.detection_time == baseline.world().metrics.detection_time, "restoring comms alone should not recover detection");
    require(!restore_comms.counterfactual.mission_success, "restoring comms alone should not recover mission");
    require(remove_logistics.counterfactual.detection_time == baseline.world().metrics.detection_time, "removing logistics delay should not recover detection");
    require(!remove_logistics.counterfactual.mission_success, "removing logistics delay should not recover mission");
    require(autonomous_search.counterfactual.detection_time == 1700, "autonomous search should improve degraded-sensor detection timing");
    require(autonomous_search.counterfactual.mission_success, "autonomous search should recover mission before cutoff");
    require(pre_authorize.counterfactual.detection_time == baseline.world().metrics.detection_time, "pre-authorization should not change detection timing");
    require(!pre_authorize.counterfactual.mission_success, "pre-authorization alone should not recover mission without detection confidence");
}

void realtimeAgentChoosesCausalAction() {
    const auto baseline = runScenarioFile(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/scenario.yaml", 42, false);
    const auto online = runScenarioFile(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/scenario.yaml", 42, true);

    bool found_decision = false;
    bool has_parent_evidence = false;
    bool chose_isolation = false;
    for (const auto& event : online.kernel.events().events()) {
        if (event.label == "online_agent_decision") {
            found_decision = true;
            has_parent_evidence = !event.causal_parent_events.empty();
            for (const auto& delta : event.deltas) {
                if (delta.field == "agent.selected_action" && delta.after == "isolate_compromised_sensor_feed") {
                    chose_isolation = true;
                }
            }
        }
    }

    require(baseline.kernel.world().metrics.detection_time == 1980, "baseline should remain unchanged without realtime agents");
    require(found_decision, "realtime agent decision event missing");
    require(has_parent_evidence, "realtime agent decision should cite causal evidence");
    require(chose_isolation, "commander agent should choose sensor isolation");
    require(online.kernel.world().metrics.detection_time == 1440, "online agent should improve detection timing");
    require(online.kernel.world().metrics.mission_success, "online agent should recover mission success");
}

void minimumInterventionSearchRanksActions() {
    const auto scenario = loadScenario();
    Snapshot snapshot;
    const auto baseline = runScenario(scenario, &snapshot);
    MinimumInterventionSearch search;
    const auto result = search.run(snapshot, baseline.world().metrics, scenario.config.max_ticks);

    require(!result.lowest_cost_effective.options.empty(), "minimum search did not find an effective intervention");
    require(result.lowest_cost_effective.options.size() == 1, "lowest-cost effective intervention should be a singleton");
    require(result.lowest_cost_effective.options.front().intervention.type == InterventionType::IsolateCompromisedSensorFeed, "lowest-cost effective intervention should isolate sensor");
    require(result.best_effective.options.size() == 2, "best mission-effect intervention should be a pair");
    require(result.best_effective.result.counterfactual.detection_time == 1320, "best pair should produce earliest detection");
    require(result.best_effective.result.counterfactual.mission_success_score > result.lowest_cost_effective.result.counterfactual.mission_success_score, "best pair should improve beyond singleton score");
}

void relationshipGraphLoadsFromScenario() {
    const auto scenario = loadScenario();
    require(scenario.relationships.size() == 8, "scenario should load typed relationship edges");
    const auto graph = RelationshipGraph::fromScenario(scenario);
    require(graph.edges().size() == 8, "relationship graph should mirror scenario relationships");
    require(!graph.edgesFrom("blue_commander", RelationshipType::Commands).empty(), "commander should command UAS");
}

void causalEstimatorRanksIsolationWhenSensorDegraded() {
    const auto scenario = loadScenario();
    Snapshot snapshot;
    runScenario(scenario, &snapshot);
    CausalActionEstimator estimator;
    const auto baseline = estimator.projectBaseline(snapshot, scenario.config.max_ticks);
    const auto* commander = snapshot.world.entityByName("blue_commander");
    const auto* uas = snapshot.world.entityByName("blue_uas_1");
    require(commander && uas, "scenario entities missing for estimator test");

    const auto isolate = estimator.estimate(snapshot, baseline, ActionType::IsolateCompromisedSensorFeed, commander->id, {uas->id}, 760, scenario.config.max_ticks);
    const auto restore = estimator.estimate(snapshot, baseline, ActionType::RestoreCommsRelay, commander->id, {entityIdFor(snapshot.world, "blue_relay_1")}, 760, scenario.config.max_ticks);

    require(isolate.supported, "sensor isolation should be causally supported when sensor is degraded");
    require(!restore.supported, "comms restore alone should not be supported when sensor is degraded");
    require(isolate.expected_mission_gain > restore.expected_mission_gain, "isolation should dominate comms restore under sensor degradation");
}

void agentHoldsWhenCausalSupportIsWeak() {
    const auto scenario = loadScenario();
    Snapshot snapshot;
    runScenario(scenario, &snapshot);
    snapshot.world.metrics.target_detected = true;
    snapshot.world.metrics.detection_time = 1200;
    snapshot.world.metrics.mission_success = true;
    snapshot.world.metrics.mission_success_score = 0.61;
    snapshot.world.detection_recorded = true;
    snapshot.world.mission_effect_recorded = true;

    RelationshipGraph graph = RelationshipGraph::fromScenario(scenario);
    CausalActionEstimator estimator;
    WorldState world = snapshot.world;
    world.agent_runtime.relationships = &graph;
    world.agent_runtime.estimator = &estimator;
    world.agent_runtime.horizon_ticks = scenario.config.max_ticks;

    BlueCommanderAgent agent;
    EventLedger ledger = snapshot.ledger;
    const auto decision = agent.decide(world, ledger, snapshot, graph, estimator);
    require(decision.selected.type == ActionType::HoldCurrentCOA, "agent should hold when causal runtime finds no supported action");
}

void realtimeAgentDecisionUsesCausalRuntime() {
    const auto online = runScenarioFile(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/scenario.yaml", 42, true);
    bool found_runtime_rationale = false;
    for (const auto& event : online.kernel.events().events()) {
        if (event.label != "online_agent_decision") continue;
        if (event.provenance.find("causal runtime estimate") != std::string::npos) {
            found_runtime_rationale = true;
        }
    }
    require(found_runtime_rationale, "online agent decision should cite causal runtime estimate");
}

Snapshot captureDegradationSnapshot(const Scenario& scenario, bool enable_agents) {
    RelationshipGraph graph;
    CausalActionEstimator estimator;
    SimulationKernel kernel;
    kernel.loadScenario(scenario);
    configureAgentRuntime(kernel.world(), scenario, graph, estimator, enable_agents);
    Snapshot snapshot;
    bool captured = false;
    while (kernel.world().tick < scenario.config.max_ticks) {
        kernel.step();
        if (!captured && kernel.world().cyber_degradation_applied) {
            snapshot = kernel.snapshot();
            captured = true;
        }
        if (captured && kernel.world().tick > snapshot.world.tick + 5) {
            break;
        }
    }
    require(captured, "failed to capture degradation snapshot");
    return snapshot;
}

void heterogeneousAgentsRecordObservations() {
    const auto online = runScenarioFile(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/scenario.yaml", 42, true);
    bool red_cyber = false;
    bool sensor = false;
    bool comms = false;
    bool uas = false;
    bool logistics = false;
    for (const auto& event : online.kernel.events().events()) {
        if (event.label == "red_cyber_agent_decision") red_cyber = true;
        if (event.label == "sensor_agent_observation") sensor = true;
        if (event.label == "comms_agent_observation") comms = true;
        if (event.label == "blue_uas_agent_observation") uas = true;
        if (event.label == "logistics_agent_observation") logistics = true;
    }
    require(red_cyber, "RedCyberAgent decision missing");
    require(sensor, "SensorAgent observation missing");
    require(comms, "CommsAgent observation missing");
    require(uas, "BlueUASAgent observation missing");
    require(logistics, "LogisticsAgent observation missing");
}

void commanderChoosesRestoreCommsWhenSensorHealthy() {
    ScenarioLoader loader;
    const auto scenario = loader.load(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/comms-only.yaml");
    const auto snapshot = captureDegradationSnapshot(scenario, false);
    RelationshipGraph graph = RelationshipGraph::fromScenario(scenario);
    CausalActionEstimator estimator;
    WorldState world = snapshot.world;
    world.agent_runtime.relationships = &graph;
    world.agent_runtime.estimator = &estimator;
    world.agent_runtime.horizon_ticks = scenario.config.max_ticks;

    BlueCommanderAgent agent;
    EventLedger ledger = snapshot.ledger;
    const auto decision = agent.decide(world, ledger, snapshot, graph, estimator);
    require(decision.selected.type == ActionType::RestoreCommsRelay, "commander should restore comms when sensor is healthy and comms are degraded");
}

void commanderChoosesPreAuthorizeWhenDetectionHighConfidence() {
    const auto scenario = loadScenario();
    Snapshot snapshot;
    runScenario(scenario, &snapshot);
    snapshot.world.tick = 1750;
    snapshot.world.metrics.target_detected = true;
    snapshot.world.metrics.detection_time = 1750;
    auto* uas = snapshot.world.entityByName("blue_uas_1");
    require(uas && uas->sensor, "UAS sensor missing for pre-authorize test");
    uas->sensor->isolated = true;
    uas->sensor->degraded = false;
    uas->sensor->confidence = 0.84;

    RelationshipGraph graph = RelationshipGraph::fromScenario(scenario);
    CausalActionEstimator estimator;
    WorldState world = snapshot.world;
    world.agent_runtime.relationships = &graph;
    world.agent_runtime.estimator = &estimator;
    world.agent_runtime.horizon_ticks = scenario.config.max_ticks;

    BlueCommanderAgent agent;
    EventLedger ledger = snapshot.ledger;
    const auto decision = agent.decide(world, ledger, snapshot, graph, estimator);
    require(decision.selected.type == ActionType::PreAuthorizeEngagement, "commander should pre-authorize when detection is complete with high confidence");
}

void commsOnlyScenarioFailsWithoutIntervention() {
    ScenarioLoader loader;
    const auto scenario = loader.load(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/comms-only.yaml");
    Snapshot snapshot;
    const auto kernel = runScenario(scenario, &snapshot);
    require(kernel.world().metrics.detection_time == 1900, "comms-only degradation should delay healthy-sensor detection");
    require(!kernel.world().metrics.mission_success, "comms-only baseline should fail mission timing");

    InterventionEngine engine;
    const auto restore = engine.run(snapshot, kernel.world().metrics, Intervention{InterventionType::RestoreCommsRelay, 760, "blue_relay_1"}, scenario.config.max_ticks);
    require(restore.counterfactual.detection_time == 1400, "restoring comms should recover timely detection");
    require(restore.counterfactual.mission_success, "restoring comms should recover mission");

    const auto isolate = engine.run(snapshot, kernel.world().metrics, Intervention{InterventionType::IsolateCompromisedSensorFeed, 760, "blue_uas_1"}, scenario.config.max_ticks);
    require(isolate.counterfactual.detection_time == kernel.world().metrics.detection_time, "isolating sensor should not recover comms-only failure");
    require(!isolate.counterfactual.mission_success, "isolating sensor should not recover comms-only mission");
    require(isolate.estimated_effect <= 0.05, "isolating sensor should have no mission gain in comms-only scenario");
}

void commsOnlySearchRanksRestoreComms() {
    ScenarioLoader loader;
    const auto scenario = loader.load(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/comms-only.yaml");
    Snapshot snapshot;
    const auto kernel = runScenario(scenario, &snapshot);

    MinimumInterventionSearch search_engine;
    const auto search = search_engine.run(snapshot, kernel.world().metrics, scenario.config.max_ticks);
    require(!search.lowest_cost_effective.options.empty(), "comms-only search should find an effective intervention");
    require(
        search.lowest_cost_effective.options.front().intervention.type == InterventionType::RestoreCommsRelay,
        "comms-only lowest-cost effective intervention should restore comms");
}

void interventionPreconditionsSharedAcrossModules() {
    ScenarioLoader loader;
    const auto scenario = loader.load(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/comms-only.yaml");
    Snapshot snapshot;
    runScenario(scenario, &snapshot);

    const auto* uas = snapshot.world.entityByName("blue_uas_1");
    const auto* relay = snapshot.world.entityByName("blue_relay_1");
    require(uas && relay, "comms-only entities missing");

    const auto isolate = evaluateInterventionPrecondition(snapshot.world, "isolate_compromised_sensor_feed", uas);
    require(!isolate.applies, "shared precondition should reject sensor isolation in comms-only scenario");

    const auto restore = evaluateInterventionPrecondition(snapshot.world, "restore_comms_relay", relay);
    require(restore.applies, "shared precondition should accept comms restore in comms-only scenario");

    CausalActionEstimator estimator;
    const auto* commander = snapshot.world.entityByName("blue_commander");
    require(commander, "commander missing");
    const auto isolate_estimate = estimator.estimate(
        snapshot,
        snapshot.world.metrics,
        ActionType::IsolateCompromisedSensorFeed,
        commander->id,
        {uas->id},
        760,
        scenario.config.max_ticks);
    require(!isolate_estimate.supported, "estimator should refuse unsupported isolate action via shared preconditions");
}

void fmuConfigParsesAndStepsStub() {
    ScenarioLoader loader;
    const auto scenario = loader.load(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/fmu-stub.yaml");
    require(scenario.fmus.size() == 1, "fmu-stub scenario should load one FMU config");
    require(scenario.fmus.front().id == "uas_sensor_fmu", "FMU id should parse");
    require(scenario.fmus.front().inputs.size() == 1, "FMU inputs should parse");
    require(scenario.fmus.front().outputs.size() == 1, "FMU outputs should parse");

    SimulationKernel kernel;
    kernel.loadScenario(scenario);
    require(kernel.world().fmu_configs.size() == 1, "kernel should copy FMU configs from scenario");
    kernel.step();

    bool fmu_event = false;
    for (const auto& event : kernel.events().events()) {
        if (event.label.rfind("fmu_step:", 0) == 0) {
            fmu_event = true;
            break;
        }
    }
    require(fmu_event, "FMU master clock should emit fmu_step event");

    bool fmu_delta = false;
    for (const auto& event : kernel.events().events()) {
        if (event.label != "fmu_step:uas_sensor_fmu") continue;
        for (const auto& delta : event.deltas) {
            if (delta.field == "blue_uas_1.sensor.confidence" && !delta.before.empty() && !delta.after.empty()) {
                fmu_delta = true;
            }
        }
    }
    require(fmu_delta, "FMU step should emit before/after delta on bound output");

    const auto* uas = kernel.world().entityByName("blue_uas_1");
    require(uas && uas->sensor, "blue_uas_1 sensor should exist");
    require(std::abs(uas->sensor->confidence - 0.88) < 0.01, "FMU should map cyber integrity to sensor confidence");
}

void pythonScriptComponentParsesFromScenario() {
    ScenarioLoader loader;
    const auto scenario = loader.load(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/scenario.yaml");
    const auto uas_it = std::find_if(
        scenario.entities.begin(),
        scenario.entities.end(),
        [](const Entity& entity) { return entity.name == "blue_uas_1"; });
    require(uas_it != scenario.entities.end(), "blue_uas_1 should exist");
    require(uas_it->python_scripts.size() == 1, "blue_uas_1 should have one Python script component");
    const auto& script = uas_it->python_scripts.front();
    require(script.object_id == "blue_uas_1", "script should be attached to blue_uas_1");
    require(script.script_path == "scenarios/uas-maritime-cyber/scripts/uas_behavior.py", "script path should parse");
    require(script.class_name == "UasBehavior", "script class should parse");
    require(script.enabled, "script should be enabled");
    require(script.params.at("min_sensor_confidence") == "0.55", "script params should parse");

    SimulationKernel kernel;
    kernel.loadScenario(scenario);
    require(kernel.world().python_script_runtime.size() == 1, "kernel should expose Python script runtime state");
    require(kernel.world().python_script_runtime.front().script_id == "blue_uas_1:UasBehavior", "script id should be stable");
}

void plantedTruthParsesFromScenario() {
    const auto scenario = loadScenario();
    require(scenario.planted_causal_truth.size() == 3, "scenario should load planted causal truth edges");
}

void typedClaimsUseVariables() {
    const auto scenario = loadScenario();
    Snapshot snapshot;
    const auto kernel = runScenario(scenario, &snapshot);
    const auto claims = CausalClaimBuilder::build(kernel.events(), kernel.world());
    bool found_sensor_variable = false;
    for (const auto& claim : claims) {
        if (claim.cause_variable == "blue_uas_1.sensor.confidence" || claim.effect_variable == "detection_time") {
            found_sensor_variable = true;
        }
    }
    require(found_sensor_variable, "typed claims should include causal variables");
}

void plantedTruthScorerMatchesEdges() {
    const auto scenario = loadScenario();
    Snapshot snapshot;
    const auto kernel = runScenario(scenario, &snapshot);
    const auto claims = CausalClaimBuilder::build(kernel.events(), kernel.world());
    PlantedTruthScorer scorer;
    const auto score = scorer.score(scenario.planted_causal_truth, claims);
    require(score.recovery_score >= 0.66, "planted truth recovery should match at least two of three edges");
    require(!score.matched_edges.empty(), "planted truth scorer should report matched edges");
}

void credibilityContractsLoadFromYaml() {
    CredibilityContractLoader loader(std::filesystem::path(DARLA_SOURCE_DIR) / "models");
    require(loader.contracts().size() >= 5, "models directory should load credibility contracts");
    CausalClaim claim;
    claim.cause_variable = "blue_uas_1.sensor.confidence";
    claim.effect_variable = "detection_time";
    const auto contract = loader.contractForClaim(claim);
    require(contract.model_name.find("sensor confidence") != std::string::npos, "sensor claim should map to sensor confidence model");
}

void emergenceDetectorFindsMetricPatterns() {
    const auto scenario = loadScenario();
    const auto kernel = runScenario(scenario);
    EmergenceDetector detector;
    const auto detection = detector.evaluate(kernel.world(), kernel.events());
    require(detection.detected, "failed mission should trigger metric-based emergence");
    require(!detection.patterns.empty(), "emergence detector should identify at least one pattern");
}

void asyncValidationProcessesAgentDecision() {
    const auto online = runScenarioFile(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/scenario.yaml", 42, true);
    require(online.has_async_summary, "online run should produce async slow-loop summary");
    require(online.async_summary.falsification_survived, "slow loop should validate commander causal assumption");
    require(online.async_summary.planted_truth_recovery >= 0.66, "slow loop should score planted truth recovery");
    require(!online.async_summary.lowest_cost_intervention.empty(), "slow loop should report minimum intervention");
}

void alwaysOnAgentsEmitMonitoring() {
    const auto online = runScenarioFile(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/scenario.yaml", 42, true);
    std::size_t monitoring_events = 0;
    std::size_t causal_monitor_events = 0;
    std::size_t credibility_events = 0;
    for (const auto& event : online.kernel.events().events()) {
        if (event.label.find("_monitoring") != std::string::npos) ++monitoring_events;
        if (event.label.find("causal_monitor") != std::string::npos) ++causal_monitor_events;
        if (event.label.find("credibility_") != std::string::npos) ++credibility_events;
    }
    require(monitoring_events >= 5, "always-on agents should emit periodic monitoring events");
    require(causal_monitor_events >= 1, "CausalMonitorAgent should scan the ledger");
    require(credibility_events >= 1, "CredibilityAgent should monitor validity envelope");
    require(online.kernel.world().agent_beliefs.commander.primary_decision_recorded, "commander belief should record primary decision");
    require(online.kernel.world().agent_beliefs.sensor.initial_observation_emitted, "sensor belief should record initial observation");
}

void agentBeliefsTrackMissionRisk() {
    const auto online = runScenarioFile(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/scenario.yaml", 42, true);
    require(online.kernel.world().agent_beliefs.commander.mission_risk > 0.0, "commander should track non-zero mission risk after cyber");
    require(online.kernel.world().agent_beliefs.sensor.trust < 0.88, "sensor trust belief should reflect degradation");
}

void agentFrameworkRegistersMaritimeAgents() {
    AgentOrchestrator orchestrator = createMaritimeAgentOrchestrator();
    require(orchestrator.registry().size() == 8, "maritime orchestrator should register eight agents");
    bool has_commander = false;
    bool has_causal = false;
    for (const auto& agent : orchestrator.registry().agents()) {
        if (agent->displayName() == "BlueCommanderAgent") has_commander = true;
        if (agent->displayName() == "CausalMonitorAgent") has_causal = true;
    }
    require(has_commander, "framework registry should include commander agent");
    require(has_causal, "framework registry should include causal monitor agent");
}

void agentFrameworkRunsThroughRuntime() {
    const auto online = runScenarioFile(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/scenario.yaml", 42, true);
    require(defaultAgentRuntime().orchestrator().registry().size() == 8, "default runtime should expose maritime registry");
    require(online.kernel.world().metrics.detection_time == 1440, "framework runtime should preserve online-agent outcome");
}

void continuousCoaRecommendations() {
    const auto online = runScenarioFile(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/scenario.yaml", 42, true);
    std::size_t recommendation_events = 0;
    for (const auto& event : online.kernel.events().events()) {
        if (event.label == "coa_recommendation") ++recommendation_events;
    }
    require(recommendation_events > 1, "commander should emit coa_recommendation more than once across the run");
}

void humanHoldBlocksAutoAction() {
    ScenarioRunOptions options;
    options.seed_override = 42;
    options.enable_realtime_agents = true;
    options.authorization_mode = AuthorizationMode::HumanHold;
    const auto online = runScenarioFile(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/scenario.yaml", options);
    bool found_decision = false;
    for (const auto& event : online.kernel.events().events()) {
        if (event.label == "online_agent_decision") found_decision = true;
    }
    require(!found_decision, "human hold should block online agent decisions");
    require(!online.kernel.world().metrics.mission_success, "human hold without approval should fail mission");
}

void explicitApprovalsReproduceRecoveryWhenApproved() {
    ScenarioRunOptions options;
    options.seed_override = 42;
    options.enable_realtime_agents = true;
    options.authorization_mode = AuthorizationMode::ExplicitApprovals;
    ApprovedCoa approved;
    require(parseApprovedCoa("isolate_compromised_sensor_feed@760", &approved), "approval token should parse");
    options.approved_coas.push_back(approved);
    const auto online = runScenarioFile(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/scenario.yaml", options);
    require(online.kernel.world().metrics.detection_time == 1440, "explicit approval should reproduce recovery timing");
    require(online.kernel.world().metrics.mission_success, "explicit approval should recover mission");
}

void explicitApprovalsWithoutApprovalFail() {
    ScenarioRunOptions options;
    options.seed_override = 42;
    options.enable_realtime_agents = true;
    options.authorization_mode = AuthorizationMode::ExplicitApprovals;
    const auto online = runScenarioFile(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/scenario.yaml", options);
    bool found_decision = false;
    for (const auto& event : online.kernel.events().events()) {
        if (event.label == "online_agent_decision") found_decision = true;
    }
    require(!found_decision, "explicit mode without approvals should not authorize actions");
    require(!online.kernel.world().metrics.mission_success, "explicit mode without approvals should fail mission");
}

void coaLifecycleCompletesAfterDetection() {
    const auto online = runScenarioFile(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/scenario.yaml", 42, true);
    bool completed = false;
    for (const auto& coa : online.kernel.world().coa_log) {
        if (coa.status == CoaStatus::Completed) completed = true;
    }
    require(completed, "approved COA should reach Completed after target detection recovers");
}

void policyAutoPreservesOnlineOutcome() {
    const auto online = runScenarioFile(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/scenario.yaml", 42, true);
    require(online.kernel.world().authorization_mode == AuthorizationMode::PolicyAuto, "default authorization mode should remain policy auto");
    require(online.kernel.world().metrics.detection_time == 1440, "policy auto should preserve T+1440 outcome");
}

void executionBudgetsTrackAgentDecisions() {
    const auto online = runScenarioFile(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/scenario.yaml", 42, true);
    require(online.kernel.world().runtime_budgets.total_usage.agent_decisions > 0, "runtime should consume agent decision budget");
}

void causalEstimatorUsesBranchCache() {
    const auto snapshot = captureDegradationSnapshot(loadScenario(), false);
    CausalActionEstimator estimator;
    const auto baseline = estimator.projectBaseline(snapshot, 5000);
    const auto* commander = snapshot.world.entityByName("blue_commander");
    const auto* uas = snapshot.world.entityByName("blue_uas_1");
    require(commander && uas, "entities missing for cache test");

    WorldState world = snapshot.world;
    EventLedger ledger;
    world.agent_runtime.horizon_ticks = 5000;
    const Tick at_tick = 760;
    const Tick horizon = horizonTicksFor(DecisionHorizon::Short, world.tick, 5000);
    const auto first = estimator.estimateActionEffect(
        world,
        ledger,
        snapshot,
        baseline,
        ActionType::IsolateCompromisedSensorFeed,
        commander->id,
        {uas->id},
        DecisionHorizon::Short);
    require(estimator.branchCacheSize() >= 1, "estimator should populate branch cache");
    const auto cached = estimator.estimate(
        snapshot,
        baseline,
        ActionType::IsolateCompromisedSensorFeed,
        commander->id,
        {uas->id},
        at_tick,
        horizon);
    require(cached.expected_mission_gain == first.expected_mission_gain, "cached branch result should match live estimate");

    ActionEffectEstimate mutated = first;
    mutated.expected_mission_gain = 0.99;
    estimator.setBranchCacheEntry(ActionType::IsolateCompromisedSensorFeed, commander->id, at_tick, horizon, mutated);
    const auto changed = estimator.estimate(
        snapshot,
        baseline,
        ActionType::IsolateCompromisedSensorFeed,
        commander->id,
        {uas->id},
        at_tick,
        horizon);
    require(changed.expected_mission_gain == 0.99, "estimator output should change when branch cache changes");
}

void metricEmergenceCanTriggerBeforeMissionFailure() {
    const auto scenario = loadScenario();
    Snapshot snapshot;
    runScenario(scenario, &snapshot);
    snapshot.world.cyber_degradation_applied = true;
    snapshot.world.metrics.detection_time = 1700;
    snapshot.world.mission.target_detected_before_tick = 1800;
    auto* uas = snapshot.world.entityByName("blue_uas_1");
    require(uas && uas->sensor, "sensor missing for emergence test");
    uas->sensor->confidence = 0.50;
    uas->sensor->degraded = true;

    EmergenceDetector detector;
    const auto detection = detector.evaluate(snapshot.world, snapshot.ledger);
    require(detection.detected, "metric emergence should trigger before mission failure is recorded");
    require(!detection.patterns.empty(), "emergence should include at least one pattern");
}

void causalQueryBudgetEmitsExceededEvent() {
    ScenarioLoader loader;
    const auto scenario = loader.load(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/scenario.yaml");
    const auto snapshot = captureDegradationSnapshot(scenario, false);
    CausalActionEstimator estimator;
    const auto baseline = estimator.projectBaseline(snapshot, scenario.config.max_ticks);
    const auto* commander = snapshot.world.entityByName("blue_commander");
    const auto* uas = snapshot.world.entityByName("blue_uas_1");
    require(commander && uas, "entities missing for budget test");

    WorldState world = snapshot.world;
    EventLedger ledger;
    world.agent_runtime.horizon_ticks = scenario.config.max_ticks;
    world.runtime_budgets.limits.causal_queries_per_tick = 1;

    (void)estimator.estimateActionEffect(
        world, ledger, snapshot, baseline, ActionType::IsolateCompromisedSensorFeed, commander->id, {uas->id}, DecisionHorizon::Short);
    (void)estimator.estimateActionEffect(
        world, ledger, snapshot, baseline, ActionType::RestoreCommsRelay, commander->id, {entityIdForName(snapshot.world, "blue_relay_1")}, DecisionHorizon::Short);

    bool budget_event = false;
    for (const auto& event : ledger.events()) {
        if (event.label == "budget_exceeded") budget_event = true;
    }
    require(budget_event, "causal query budget exhaustion should emit budget_exceeded event");
}

void approveCoaCommandSchedulesIntervention() {
    ScenarioRunOptions options;
    options.seed_override = 42;
    options.enable_realtime_agents = true;
    options.authorization_mode = AuthorizationMode::HumanHold;
    const auto online = runScenarioFile(std::filesystem::path(DARLA_SOURCE_DIR) / "scenarios/uas-maritime-cyber/scenario.yaml", options);

    WorldState world = online.kernel.world();
    EventLedger ledger = online.kernel.events();
    require(!world.coa_log.empty(), "scenario should emit COA recommendations");

    const auto& coa = world.coa_log.front();
    ApproveCoaCommand command;
    command.coa_id = coa.id;
    command.action = toString(coa.action);
    command.target = coa.target;
    command.scheduled_at_tick = coa.scheduled_at_tick;
    command.issued_at_tick = coa.proposed_tick;
    command.authority = "human";

    const auto result = applyApproveCoa(world, ledger, command);
    require(result.ok, "approve COA command should succeed");
    require(!world.scheduled_interventions.empty(), "approval should schedule intervention");

    bool found_approval_event = false;
    for (const auto& event : ledger.events()) {
        if (event.label == "human_approved_coa") found_approval_event = true;
    }
    require(found_approval_event, "approval should append human_approved_coa event");
}

const CausalClaim* findClaimByLabel(const std::vector<CausalClaim>& claims, const std::string& label) {
    for (const auto& claim : claims) {
        if (claim.label == label) return &claim;
    }
    return nullptr;
}

// do-calculus identification must DERIVE each claim's status from the structural DAG,
// not assert it: the chain edges are (weakly) identifiable, the logistics correlate is
// confounded, and the directly manipulated cyber edge is directly adjudicated.
void identificationDerivesClaimStatuses() {
    const auto scenario = loadScenario();

    std::vector<std::pair<std::string, std::string>> latents{{"detection_time", "mission_success_score"}};
    CausalIdentifier identifier(scenario.planted_causal_truth, latents);
    require(identifier.identify("blue_uas_1.sensor.confidence", "detection_time").status == ClaimStatus::Identifiable,
            "sensor->detection should be identifiable via empty back-door set");
    require(identifier.identify("detection_time", "mission_success_score").status == ClaimStatus::WeaklyIdentifiable,
            "detection->mission should be weakly identifiable under the latent confounder");
    require(identifier.identify("logistics.delay", "mission_success_score").status == ClaimStatus::Confounded,
            "logistics->mission should be reported confounded (no directed path)");
    require(identifier.identify("red_cyber_actor.degrade_sensor_feed", "blue_uas_1.sensor.confidence").status == ClaimStatus::DirectlyAdjudicated,
            "cyber->sensor should be directly adjudicated");

    Snapshot snapshot;
    const auto kernel = runScenario(scenario, &snapshot);
    const auto claims = CausalClaimBuilder::build(kernel.events(), kernel.world());

    const auto* sensor = findClaimByLabel(claims, "sensor_confidence_loss -> delayed_detection");
    const auto* mission = findClaimByLabel(claims, "delayed_detection -> mission_failure");
    const auto* logistics = findClaimByLabel(claims, "logistics_delay -> mission_failure rejected");
    require(sensor && mission && logistics, "expected the three inferred causal claims");
    require(sensor->status == ClaimStatus::Identifiable, "sensor claim status should be identification-derived");
    require(mission->status == ClaimStatus::WeaklyIdentifiable, "mission claim status should be identification-derived");
    require(logistics->status == ClaimStatus::Confounded, "logistics claim must be overturned via the back-door test, not hardcoded");

    // Effect sizes and confidences must be DERIVED (no magic constants).
    require(sensor->effect_size > 0.10 && sensor->effect_size < 0.30, "sensor->detection effect should be the derived ~0.19 ATE");
    require(sensor->confidence > 0.80 && sensor->confidence <= 1.0, "sensor->detection P(tau>0) should be high and derived");
    require(std::abs(logistics->effect_size) < 0.05, "confounded logistics effect should collapse to ~0");
}

// The structural noise model and the Monte-Carlo ensemble must be reproducible per seed.
void monteCarloEnsembleIsReproducible() {
    StructuralCausalModel scm;
    DetectionInputs degraded;
    degraded.degraded = true;
    require(scm.detectionTick(degraded, 4242, 1001) == scm.detectionTick(degraded, 4242, 1001),
            "structural noise draw must be deterministic per (seed, stream)");
    require(scm.detectionTickMean(degraded) == 1980, "noise-free structural mean must reproduce the baseline ladder");

    const auto scenario = loadScenario();
    const auto snapshot = captureDegradationSnapshot(scenario, false);
    CausalEffectEstimator estimator;
    EffectEstimatorConfig cfg;
    cfg.replicates = 10;
    cfg.base_seed = 2024;
    const std::vector<Intervention> treatment{Intervention{InterventionType::IsolateCompromisedSensorFeed, 760, "blue_uas_1"}};
    const auto a = estimator.estimateInterventionEffect(snapshot, treatment, scenario.config.max_ticks, cfg);
    const auto b = estimator.estimateInterventionEffect(snapshot, treatment, scenario.config.max_ticks, cfg);
    require(a.ate == b.ate && a.ci_low == b.ci_low && a.ci_high == b.ci_high, "Monte-Carlo ensemble must be reproducible per seed");
    require(a.ate > 0.10 && a.ate < 0.30, "isolate intervention effect should be the derived ~0.19 ATE");
    require(a.ci_high > a.ci_low, "bootstrap interval must be non-degenerate");
    require(a.prob_positive > 0.80, "P(tau>0) should be high for the strong sensor-restore effect");
}

// The calibration harness must report well-calibrated probabilities, near-nominal CI
// coverage, and full planted-DAG recovery.
void calibrationHarnessMeetsAccuracyThresholds() {
    const auto scenario = loadScenario();
    CalibrationHarness harness;
    CalibrationConfig config;
    config.outcome_seeds = 12;
    config.ci_experiments = 12;
    config.ci_replicates = 16;
    const auto report = harness.run(scenario, config);

    require(report.recovery.recovery_score >= 0.66, "planted-DAG recall should recover the chain");
    require(report.recovery.f1 >= 0.66, "planted-DAG F1 should clear the agreed threshold");
    require(report.recovery.structural_hamming_distance <= 1, "structural Hamming distance to planted DAG should be tiny");
    require(report.brier_score < 0.10, "mission-success probabilities should be well calibrated (Brier)");
    require(report.expected_calibration_error < 0.10, "expected calibration error should be small");
    require(report.true_effect > 0.10 && report.true_effect < 0.30, "ground-truth chain effect should be the derived ~0.19");
    require(report.ci_coverage >= 0.6, "90% confidence interval should cover the true effect most of the time");
}

} // namespace

int main() {
    deterministicReplayHashMatches();
    identificationDerivesClaimStatuses();
    monteCarloEnsembleIsReproducible();
    calibrationHarnessMeetsAccuracyThresholds();
    taiwanOpenDataScenarioLoads();
    taiwanOpenDataDeterministicReplayMatchesGolden();
    ledgerIntegrityHolds();
    counterfactualImprovesMissionScore();
    interventionTimingIsCausal();
    exportedLedgerHashMatchesBody();
    sharedScenarioRunnerCapturesSnapshot();
    ledgerRejectsTemporalRegression();
    credibilityAssessmentsRejectFalseCause();
    falsificationBranchesTestAlternates();
    realtimeAgentChoosesCausalAction();
    minimumInterventionSearchRanksActions();
    relationshipGraphLoadsFromScenario();
    causalEstimatorRanksIsolationWhenSensorDegraded();
    agentHoldsWhenCausalSupportIsWeak();
    realtimeAgentDecisionUsesCausalRuntime();
    heterogeneousAgentsRecordObservations();
    commanderChoosesRestoreCommsWhenSensorHealthy();
    commanderChoosesPreAuthorizeWhenDetectionHighConfidence();
    commsOnlyScenarioFailsWithoutIntervention();
    commsOnlySearchRanksRestoreComms();
    interventionPreconditionsSharedAcrossModules();
    fmuConfigParsesAndStepsStub();
    pythonScriptComponentParsesFromScenario();
    plantedTruthParsesFromScenario();
    typedClaimsUseVariables();
    plantedTruthScorerMatchesEdges();
    credibilityContractsLoadFromYaml();
    emergenceDetectorFindsMetricPatterns();
    asyncValidationProcessesAgentDecision();
    alwaysOnAgentsEmitMonitoring();
    agentBeliefsTrackMissionRisk();
    agentFrameworkRegistersMaritimeAgents();
    agentFrameworkRunsThroughRuntime();
    continuousCoaRecommendations();
    humanHoldBlocksAutoAction();
    explicitApprovalsReproduceRecoveryWhenApproved();
    explicitApprovalsWithoutApprovalFail();
    coaLifecycleCompletesAfterDetection();
    policyAutoPreservesOnlineOutcome();
    executionBudgetsTrackAgentDecisions();
    causalEstimatorUsesBranchCache();
    metricEmergenceCanTriggerBeforeMissionFailure();
    causalQueryBudgetEmitsExceededEvent();
    approveCoaCommandSchedulesIntervention();
    std::cout << "All DARLA prototype tests passed\n";
    return 0;
}
