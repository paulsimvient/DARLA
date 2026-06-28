/**
 * Legacy CoSim demo fixtures (Scenario Alpha, DDG-47, synthetic FMU catalog).
 * Do not import from production pages — use dashboard-backed coSimFromDashboard instead.
 */
import type {
  CoSimLogEntry,
  CoSimModel,
  ExecutionGraphEdge,
  ExecutionGraphNode,
  ModelLibraryCategory,
  ScriptTab,
} from "../types/cosimStudio";

export type {
  CoSimLogEntry,
  CoSimModel,
  ExecutionGraphEdge,
  ExecutionGraphNode,
  ModelLibraryCategory,
  ScriptTab,
} from "../types/cosimStudio";

export const MISSION_LOGIC_SCRIPT = `from darla import scenario, fmu, event, causal, coa

# Load FMI / FMU models
uav = fmu.load("uav_flight_dynamics.fmu", name="blue_uav")
radar = fmu.load("radar_detection.fmu", name="red_radar")
comms = fmu.load("comms_degradation.fmu", name="enemy_c2_comms")
fuel = fmu.load("fuel_consumption.fmu", name="blue_fuel_model")

# Configure run
scenario.set_time_step(1.0)
scenario.set_duration(minutes=60)

# Bind FMU variables to DARLA scenario entities
uav.bind_input("commanded_heading", "blue.uav.heading")
uav.bind_input("commanded_speed", "blue.uav.speed")
radar.bind_input("target_range_km", "blue.uav.range_to_red_radar_km")
radar.bind_input("weather_visibility_km", "environment.visibility_km")
fuel.bind_input("throttle", "blue.uav.throttle")

@scenario.on_tick
def update(t):
    # Step platform model
    uav.step(t)
    fuel.step(t)

    # Feed UAV outputs into radar model
    radar.set("target_range_km", uav.get("range_to_red_radar_km"))
    radar.set("target_altitude_ft", uav.get("altitude_ft"))
    radar.step(t)

    # Emit event when radar detects UAV
    if radar.get("detected"):
        evt = event.emit(
            type="observation",
            title="Blue UAV detected by red radar",
            time=t,
            confidence=radar.get("detection_confidence"),
            entity="blue_uav"
        )

        causal.assert_link(
            source=evt.id,
            target="blue_uav_survivability_decreases",
            relation="increases_risk_of",
            confidence=radar.get("detection_confidence")
        )

        coa.update_score(
            coa_id="coa_1",
            metric="risk",
            delta=0.12,
            reason="Red radar detection increases UAV survivability risk"
        )

@scenario.on_event("cyber_attack_enemy_c2")
def degrade_enemy_c2(evt):
    comms.set("attack_intensity", evt.params["intensity"])
    comms.step(evt.time)

    latency = comms.get("latency_ms")
    packet_loss = comms.get("packet_loss")

    causal.assert_effect(
        action="cyber_attack_enemy_c2",
        effect="enemy_c2_degraded",
        values={
            "latency_ms": latency,
            "packet_loss": packet_loss
        },
        confidence=0.82
    )

    coa.update_score(
        coa_id="coa_1",
        metric="success_probability",
        delta=0.08,
        reason="Enemy C2 degradation improves blue maneuver window"
    )

scenario.run()`;

export const scriptTabs: ScriptTab[] = [
  {
    id: "mission_logic",
    filename: "mission_logic.py",
    language: "python",
    content: MISSION_LOGIC_SCRIPT,
  },
  {
    id: "bindings",
    filename: "bindings.yaml",
    language: "yaml",
    content: `# FMU variable bindings
fmus:
  blue_uav:
    file: uav_flight_dynamics.fmu
    inputs:
      commanded_heading: blue.uav.heading
      commanded_speed: blue.uav.speed
    outputs:
      position: map.blue_uav.position
      altitude_ft: telemetry.blue_uav.altitude

  red_radar:
    file: radar_detection.fmu
    inputs:
      target_range_km: blue.uav.range_to_red_radar_km
      weather_visibility_km: environment.visibility_km
    outputs:
      detected: event.red_radar_detected_uav
      detection_confidence: causal.confidence

  enemy_c2_comms:
    file: comms_degradation.fmu
    inputs:
      attack_intensity: events.cyber_attack.intensity
    outputs:
      latency_ms: causal.enemy_c2_latency
      packet_loss: causal.enemy_c2_packet_loss`,
  },
  {
    id: "scenario",
    filename: "scenario.json",
    language: "json",
    content: `{
  "scenario_id": "scenario-alpha",
  "time_step_sec": 1.0,
  "duration_min": 60,
  "co_sim_master": "darla",
  "fmi_version": "3.0",
  "default_interface": "Co-Simulation"
}`,
  },
  {
    id: "coa_rules",
    filename: "coa_rules.darla",
    language: "darla",
    content: `# COA scoring rules for co-simulation outputs
coa coa_1 {
  on causal.enemy_c2_degraded {
    success_probability += 0.08
    reason = "Enemy C2 degradation improves blue maneuver window"
  }
  on event.red_radar_detected_uav {
    risk += 0.12
    reason = "Red radar detection increases UAV survivability risk"
  }
}`,
  },
];

export const coSimModels: CoSimModel[] = [
  {
    id: "fmu-radar",
    name: "radar_detection.fmu",
    filename: "radar_detection.fmu",
    category: "fmu",
    fmiVersion: "3.0",
    interfaceType: "Co-Simulation",
    stepSize: "1.0 sec",
    inputs: [
      { name: "target_range_km", type: "float", unit: "km" },
      { name: "target_altitude_ft", type: "float", unit: "ft" },
      { name: "weather_visibility_km", type: "float", unit: "km" },
      { name: "radar_mode", type: "enum", description: "search | track | standby" },
    ],
    outputs: [
      { name: "detected", type: "bool" },
      { name: "detection_confidence", type: "float" },
      { name: "track_quality", type: "float" },
      { name: "time_to_track_sec", type: "float", unit: "sec" },
    ],
    bindings: [
      { variable: "target_range_km", direction: "input", binding: "blue_uav.range_to_red_radar_km" },
      { variable: "weather_visibility_km", direction: "input", binding: "environment.visibility_km" },
      { variable: "detected", direction: "output", binding: "event.red_radar_detected_uav" },
      { variable: "detection_confidence", direction: "output", binding: "causal.confidence" },
    ],
    validationState: "validated",
    status: "ready",
  },
  {
    id: "fmu-uav",
    name: "uav_flight_dynamics.fmu",
    filename: "uav_flight_dynamics.fmu",
    category: "fmu",
    fmiVersion: "3.0",
    interfaceType: "Co-Simulation",
    stepSize: "0.5 sec",
    inputs: [
      { name: "commanded_heading", type: "float", unit: "deg" },
      { name: "commanded_speed", type: "float", unit: "kts" },
      { name: "wind_speed_kts", type: "float", unit: "kts" },
    ],
    outputs: [
      { name: "position", type: "struct", description: "lat, lon, alt" },
      { name: "altitude_ft", type: "float", unit: "ft" },
      { name: "range_to_red_radar_km", type: "float", unit: "km" },
      { name: "heading", type: "float", unit: "deg" },
    ],
    bindings: [
      { variable: "commanded_heading", direction: "input", binding: "blue.uav.heading" },
      { variable: "commanded_speed", direction: "input", binding: "blue.uav.speed" },
      { variable: "range_to_red_radar_km", direction: "output", binding: "red_radar.target_range_km" },
    ],
    validationState: "validated",
    status: "ready",
  },
  {
    id: "fmu-comms",
    name: "comms_degradation.fmu",
    filename: "comms_degradation.fmu",
    category: "fmu",
    fmiVersion: "2.0",
    interfaceType: "Co-Simulation",
    stepSize: "1.0 sec",
    inputs: [
      { name: "attack_intensity", type: "float", unit: "0-1" },
      { name: "baseline_latency_ms", type: "float", unit: "ms" },
    ],
    outputs: [
      { name: "latency_ms", type: "float", unit: "ms" },
      { name: "packet_loss", type: "float", unit: "0-1" },
      { name: "throughput_mbps", type: "float", unit: "Mbps" },
    ],
    bindings: [
      { variable: "attack_intensity", direction: "input", binding: "events.cyber_attack.intensity" },
      { variable: "latency_ms", direction: "output", binding: "causal.enemy_c2_latency" },
      { variable: "packet_loss", direction: "output", binding: "causal.enemy_c2_packet_loss" },
    ],
    validationState: "validated",
    status: "ready",
  },
  {
    id: "fmu-fuel",
    name: "fuel_consumption.fmu",
    filename: "fuel_consumption.fmu",
    category: "fmu",
    fmiVersion: "3.0",
    interfaceType: "Model Exchange",
    stepSize: "1.0 sec",
    inputs: [
      { name: "throttle", type: "float", unit: "0-1" },
      { name: "altitude_ft", type: "float", unit: "ft" },
    ],
    outputs: [
      { name: "fuel_remaining_kg", type: "float", unit: "kg" },
      { name: "fuel_flow_kg_hr", type: "float", unit: "kg/hr" },
    ],
    bindings: [
      { variable: "throttle", direction: "input", binding: "blue.uav.throttle" },
    ],
    validationState: "pending",
    status: "ready",
  },
  {
    id: "fmu-missile",
    name: "missile_engagement.fmu",
    filename: "missile_engagement.fmu",
    category: "fmu",
    fmiVersion: "3.0",
    interfaceType: "Scheduled Execution",
    stepSize: "0.1 sec",
    inputs: [
      { name: "target_track", type: "struct" },
      { name: "launch_authorization", type: "bool" },
    ],
    outputs: [
      { name: "pk", type: "float", description: "Probability of kill" },
      { name: "time_to_impact_sec", type: "float", unit: "sec" },
    ],
    bindings: [],
    validationState: "draft",
    status: "ready",
  },
  {
    id: "native-blue-agent",
    name: "Blue force agent",
    category: "agent",
    inputs: [{ name: "observations", type: "struct" }],
    outputs: [{ name: "actions", type: "struct" }],
    bindings: [],
    validationState: "validated",
    status: "ready",
    description: "Blue force decision policy",
  },
  {
    id: "native-red-agent",
    name: "Red force agent",
    category: "agent",
    inputs: [{ name: "threat_picture", type: "struct" }],
    outputs: [{ name: "responses", type: "struct" }],
    bindings: [],
    validationState: "validated",
    status: "ready",
    description: "Red force reactive policy",
  },
  {
    id: "native-logistics",
    name: "Logistics planner",
    category: "native",
    inputs: [{ name: "resource_state", type: "struct" }],
    outputs: [{ name: "allocation_plan", type: "struct" }],
    bindings: [],
    validationState: "validated",
    status: "ready",
  },
  {
    id: "native-coa-scorer",
    name: "COA scorer",
    category: "native",
    inputs: [{ name: "causal_updates", type: "stream" }, { name: "events", type: "stream" }],
    outputs: [{ name: "coa_scores", type: "struct" }],
    bindings: [],
    validationState: "validated",
    status: "ready",
  },
  {
    id: "native-causal",
    name: "Causal reasoner",
    category: "native",
    inputs: [{ name: "events", type: "stream" }, { name: "fmu_outputs", type: "stream" }],
    outputs: [{ name: "causal_graph", type: "graph" }],
    bindings: [],
    validationState: "validated",
    status: "ready",
  },
  {
    id: "feed-weather",
    name: "weather feed",
    category: "data_feed",
    inputs: [],
    outputs: [{ name: "visibility_km", type: "float" }, { name: "wind_kts", type: "float" }],
    bindings: [{ variable: "visibility_km", direction: "output", binding: "environment.visibility_km" }],
    validationState: "validated",
    status: "ready",
  },
  {
    id: "feed-intel",
    name: "intel feed",
    category: "data_feed",
    inputs: [],
    outputs: [{ name: "threat_reports", type: "stream" }],
    bindings: [],
    validationState: "validated",
    status: "ready",
  },
  {
    id: "feed-events",
    name: "event log",
    category: "data_feed",
    inputs: [{ name: "events", type: "stream" }],
    outputs: [],
    bindings: [],
    validationState: "validated",
    status: "ready",
  },
  {
    id: "feed-constraints",
    name: "commander constraints",
    category: "data_feed",
    inputs: [],
    outputs: [{ name: "roe", type: "struct" }, { name: "priority_objectives", type: "list" }],
    bindings: [],
    validationState: "validated",
    status: "ready",
  },
];

export const executionGraphNodes: ExecutionGraphNode[] = [
  { id: "weather", label: "Weather Feed", type: "data_feed", x: 40, y: 30 },
  { id: "uav", label: "UAV Flight Dynamics FMU", type: "fmu", x: 180, y: 30 },
  { id: "radar", label: "Radar Detection FMU", type: "fmu", x: 360, y: 30 },
  { id: "bus", label: "DARLA Event Bus", type: "bus", x: 540, y: 30 },
  { id: "comms", label: "Comms Degradation FMU", type: "fmu", x: 180, y: 110 },
  { id: "cyber", label: "Cyber Action Script", type: "native", x: 40, y: 110 },
  { id: "coa1", label: "COA 1: Seize Initiative", type: "coa", x: 40, y: 190 },
  { id: "causal", label: "Causal Graph", type: "causal", x: 540, y: 110 },
  { id: "scorer", label: "COA Scorer", type: "native", x: 720, y: 70 },
  { id: "timeline", label: "Timeline / Evidence", type: "timeline", x: 900, y: 70 },
];

export const executionGraphEdges: ExecutionGraphEdge[] = [
  { from: "weather", to: "uav" },
  { from: "weather", to: "radar" },
  { from: "uav", to: "radar" },
  { from: "radar", to: "bus" },
  { from: "coa1", to: "cyber" },
  { from: "cyber", to: "comms" },
  { from: "comms", to: "causal", label: "latency" },
  { from: "bus", to: "causal" },
  { from: "causal", to: "scorer" },
  { from: "scorer", to: "timeline" },
  { from: "bus", to: "timeline" },
];

export const coSimLogs: CoSimLogEntry[] = [
  { id: "log-1", timestamp: "15:42:01Z", level: "info", message: "Co-sim orchestrator initialized — FMI 3.0, step 1.0s" },
  { id: "log-2", timestamp: "15:42:02Z", level: "info", message: "Loaded FMU: uav_flight_dynamics.fmu (Co-Simulation)" },
  { id: "log-3", timestamp: "15:42:02Z", level: "info", message: "Loaded FMU: radar_detection.fmu (Co-Simulation)" },
  { id: "log-4", timestamp: "15:42:03Z", level: "info", message: "Loaded FMU: comms_degradation.fmu (Co-Simulation)" },
  { id: "log-5", timestamp: "15:42:05Z", level: "success", message: "Tick t=2472 — radar.get(detected)=1 → event emitted" },
  { id: "log-6", timestamp: "15:42:05Z", level: "info", message: "causal.assert_link → blue_uav_survivability_decreases (conf=0.88)" },
  { id: "log-7", timestamp: "15:42:10Z", level: "success", message: "Event cyber_attack_enemy_c2 → comms.step() latency=340ms" },
  { id: "log-8", timestamp: "15:42:10Z", level: "info", message: "coa.update_score coa_1 success_probability +0.08" },
  { id: "log-9", timestamp: "15:42:12Z", level: "warn", message: "fuel_consumption.fmu validation pending — using default params" },
  { id: "log-10", timestamp: "15:42:15Z", level: "info", message: "Execution graph synced — 10 nodes, 11 edges" },
];

export const modelLibrarySections: { key: ModelLibraryCategory; label: string }[] = [
  { key: "fmu", label: "FMU Models" },
  { key: "native", label: "Native Modules" },
  { key: "agent", label: "Agents" },
  { key: "data_feed", label: "Data Feeds" },
];

export function getCoSimModelById(id: string): CoSimModel | undefined {
  return coSimModels.find((m) => m.id === id);
}

export function getModelsByCategory(category: ModelLibraryCategory): CoSimModel[] {
  return coSimModels.filter((m) => m.category === category);
}

export const defaultSelectedModelId = "fmu-radar";
