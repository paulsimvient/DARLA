/**
 * Legacy scenario explorer demo fixtures (Scenario Alpha, OBJ BRAVO, DDG-47, etc.).
 * Production pages use SimulationContext + sim-export dashboard data instead.
 */
import type { SimModule } from "../types/moduleCanvas";

export type ForceSide = "blue" | "red" | "neutral";

export type Scenario = {
  id: string;
  name: string;
  subtitle: string;
  timestamp: string;
  date: string;
  status: "live" | "paused" | "complete";
  forces: {
    blue: number;
    red: number;
    neutral: number;
  };
  environment: {
    weather: string;
    seaState: string;
    wind: string;
    visibility: string;
  };
  assets: {
    air: number;
    naval: number;
    cyber: number;
    space: number;
  };
};

export type MapEntity = {
  id: string;
  label: string;
  side: ForceSide;
  type: "air" | "naval" | "ground" | "cyber" | "sensor" | "objective";
  x: number;
  y: number;
  status: "active" | "degraded" | "destroyed" | "unknown";
};

export type COA = {
  id: string;
  rank: number;
  name: string;
  subtitle: string;
  successProbability: number;
  risk: "low" | "medium" | "high";
  expectedTime: string;
  keyActions: string[];
  expectedEffects: string[];
  resourceDemand: "low" | "medium" | "high";
  confidence: number;
  causalRationale: string;
  reversibility: "high" | "medium" | "low";
  recommended: boolean;
};

export type TimelineEvent = {
  id: string;
  timestamp: string;
  title: string;
  type: "observation" | "cyber" | "kinetic" | "effect" | "movement" | "warning";
  confidence: number;
  relatedCOAIds: string[];
  source: string;
  affectedObject: string;
  simulationTick: number;
  causalLinks: string[];
  evidence: string;
};

export type CausalNodeType =
  | "observation"
  | "inference"
  | "action"
  | "effect"
  | "risk"
  | "outcome"
  | "evidence";

export type CausalNode = {
  id: string;
  label: string;
  type: CausalNodeType;
  confidence: number;
  x: number;
  y: number;
  evidence?: string;
  upstream: string[];
  downstream: string[];
};

export type { ModuleCategory, SimModule } from "../types/moduleCanvas";

export type SimulationRun = {
  id: string;
  scenario: string;
  coa: string;
  status: "running" | "complete" | "failed" | "branch";
  startTime: string;
  duration: string;
  successProbability: number;
  risk: "low" | "medium" | "high";
  evidence: string;
  scenarioVersion: string;
  perturbation?: string;
  branchId?: string;
  parentRunId?: string | null;
};

export const scenario: Scenario = {
  id: "scenario-alpha",
  name: "Scenario Alpha",
  subtitle: "Hybrid Contested Littoral",
  timestamp: "15:42:31Z",
  date: "22 MAY 2025",
  status: "live",
  forces: { blue: 24, red: 18, neutral: 6 },
  environment: {
    weather: "Partly Cloudy",
    seaState: "2 - Moderate",
    wind: "12 kts NE",
    visibility: "15 km",
  },
  assets: { air: 12, naval: 7, cyber: 4, space: 2 },
};

export const mapEntities: MapEntity[] = [
  { id: "obj-alpha", label: "OBJ ALPHA", side: "neutral", type: "objective", x: 28, y: 35, status: "active" },
  { id: "obj-bravo", label: "OBJ BRAVO", side: "neutral", type: "objective", x: 45, y: 55, status: "active" },
  { id: "obj-charlie", label: "OBJ CHARLIE", side: "neutral", type: "objective", x: 72, y: 42, status: "active" },
  { id: "blue-uav-1", label: "UAV-1", side: "blue", type: "air", x: 22, y: 48, status: "active" },
  { id: "blue-uav-2", label: "UAV-2", side: "blue", type: "air", x: 35, y: 62, status: "active" },
  { id: "blue-naval-1", label: "DDG-47", side: "blue", type: "naval", x: 18, y: 72, status: "active" },
  { id: "blue-strike", label: "Strike Pkg", side: "blue", type: "air", x: 40, y: 38, status: "active" },
  { id: "blue-c2", label: "Blue C2", side: "blue", type: "cyber", x: 12, y: 28, status: "active" },
  { id: "red-sam", label: "SAM Bty", side: "red", type: "ground", x: 68, y: 58, status: "active" },
  { id: "red-radar", label: "Radar Site", side: "red", type: "sensor", x: 82, y: 35, status: "destroyed" },
  { id: "red-c2", label: "Red C2", side: "red", type: "cyber", x: 88, y: 52, status: "degraded" },
  { id: "red-naval", label: "FFG-12", side: "red", type: "naval", x: 78, y: 68, status: "active" },
];

export const coas: COA[] = [
  {
    id: "coa-1",
    rank: 1,
    name: "COA 1",
    subtitle: "Seize Initiative",
    successProbability: 72,
    risk: "medium",
    expectedTime: "45 min",
    keyActions: [
      "Deploy UAV reconnaissance over OBJ BRAVO",
      "Initiate cyber effects on enemy C2 node",
      "Launch coordinated strike package",
    ],
    expectedEffects: [
      "Enemy radar degraded within 15 min",
      "Blue maneuver corridor opened to OBJ CHARLIE",
      "Red SAM engagement window reduced",
    ],
    resourceDemand: "medium",
    confidence: 0.84,
    causalRationale:
      "Cyber degradation of Red C2 slows enemy decision cycle, increasing Blue strike window before SAM activation.",
    reversibility: "medium",
    recommended: true,
  },
  {
    id: "coa-2",
    rank: 2,
    name: "COA 2",
    subtitle: "Shape Operations",
    successProbability: 61,
    risk: "medium",
    expectedTime: "90 min",
    keyActions: [
      "Establish persistent ISR orbit",
      "Conduct shaping fires on radar sites",
      "Hold strike package in reserve",
    ],
    expectedEffects: [
      "Improved situational awareness",
      "Gradual degradation of enemy IADS",
      "Lower immediate resource expenditure",
    ],
    resourceDemand: "low",
    confidence: 0.76,
    causalRationale:
      "Gradual shaping reduces escalation risk but delays mission effect; favorable when time permits.",
    reversibility: "high",
    recommended: false,
  },
  {
    id: "coa-3",
    rank: 3,
    name: "COA 3",
    subtitle: "Deny & Degrade",
    successProbability: 48,
    risk: "high",
    expectedTime: "30 min",
    keyActions: [
      "Immediate kinetic strike on Red C2",
      "Suppress enemy SAM batteries",
      "Accept higher collateral risk near OBJ CHARLIE",
    ],
    expectedEffects: [
      "Rapid enemy C2 disruption",
      "High Blue asset exposure",
      "Uncertain civilian impact assessment",
    ],
    resourceDemand: "high",
    confidence: 0.62,
    causalRationale:
      "Aggressive kinetic approach achieves rapid effect but increases Blue losses and mission risk.",
    reversibility: "low",
    recommended: false,
  },
];

export const timelineEvents: TimelineEvent[] = [
  {
    id: "evt-1",
    timestamp: "15:41:12Z",
    title: "Blue UAV detected activity near OBJ BRAVO",
    type: "observation",
    confidence: 0.91,
    relatedCOAIds: ["coa-1", "coa-2"],
    source: "UAV-1 Sensor Suite",
    affectedObject: "OBJ BRAVO",
    simulationTick: 2472,
    causalLinks: ["Blue UAV detects activity", "Enemy C2 node active"],
    evidence: "EO/IR imagery confirms vehicle movement pattern consistent with C2 relay activity.",
  },
  {
    id: "evt-2",
    timestamp: "15:41:48Z",
    title: "Red SAM battery activated",
    type: "warning",
    confidence: 0.88,
    relatedCOAIds: ["coa-1", "coa-3"],
    source: "SIGINT Monitor",
    affectedObject: "SAM Bty",
    simulationTick: 2508,
    causalLinks: ["Enemy C2 node active", "Red SAM battery activated"],
    evidence: "Radar emissions detected at 15:41:48Z matching SA-21 search pattern.",
  },
  {
    id: "evt-3",
    timestamp: "15:42:10Z",
    title: "Cyber attack on enemy C2 node",
    type: "cyber",
    confidence: 0.79,
    relatedCOAIds: ["coa-1"],
    source: "Cyber Effects Module",
    affectedObject: "Red C2",
    simulationTick: 2530,
    causalLinks: ["Cyber attack initiated", "Enemy C2 degraded"],
    evidence: "Network intrusion confirmed; C2 latency increased 340%.",
  },
  {
    id: "evt-4",
    timestamp: "15:42:35Z",
    title: "Electronic warfare degraded effect",
    type: "effect",
    confidence: 0.72,
    relatedCOAIds: ["coa-1", "coa-2"],
    source: "EW Module",
    affectedObject: "Red C2",
    simulationTick: 2555,
    causalLinks: ["Enemy C2 degraded", "Enemy decision cycle slowed"],
    evidence: "Comms intercept shows 2.1x increase in enemy decision latency.",
  },
  {
    id: "evt-5",
    timestamp: "15:43:02Z",
    title: "Blue strike package inbound",
    type: "movement",
    confidence: 0.95,
    relatedCOAIds: ["coa-1", "coa-3"],
    source: "Blue C2",
    affectedObject: "Strike Pkg",
    simulationTick: 2582,
    causalLinks: ["Blue maneuver freedom increased", "Blue strike package inbound"],
    evidence: "Flight plan filed; 4 aircraft ETA 15:48Z to OBJ CHARLIE.",
  },
  {
    id: "evt-6",
    timestamp: "15:43:55Z",
    title: "Red radar site destroyed",
    type: "kinetic",
    confidence: 0.87,
    relatedCOAIds: ["coa-1", "coa-3"],
    source: "BDA Module",
    affectedObject: "Radar Site",
    simulationTick: 2635,
    causalLinks: ["Blue strike package inbound", "Red radar site destroyed"],
    evidence: "Post-strike imagery shows radar array non-operational.",
  },
];

export const causalNodes: CausalNode[] = [
  {
    id: "cn-1",
    label: "Blue UAV detects activity",
    type: "observation",
    confidence: 0.91,
    x: 80,
    y: 120,
    evidence: "UAV-1 EO/IR feed",
    upstream: [],
    downstream: ["cn-2"],
  },
  {
    id: "cn-2",
    label: "Enemy C2 node active",
    type: "inference",
    confidence: 0.85,
    x: 240,
    y: 100,
    upstream: ["cn-1"],
    downstream: ["cn-3", "cn-4"],
  },
  {
    id: "cn-3",
    label: "Cyber attack initiated",
    type: "action",
    confidence: 0.79,
    x: 400,
    y: 60,
    upstream: ["cn-2"],
    downstream: ["cn-5"],
  },
  {
    id: "cn-4",
    label: "Red SAM battery activated",
    type: "risk",
    confidence: 0.88,
    x: 400,
    y: 160,
    upstream: ["cn-2"],
    downstream: ["cn-8"],
  },
  {
    id: "cn-5",
    label: "Enemy C2 degraded",
    type: "effect",
    confidence: 0.76,
    x: 560,
    y: 80,
    upstream: ["cn-3"],
    downstream: ["cn-6"],
  },
  {
    id: "cn-6",
    label: "Enemy decision cycle slowed",
    type: "effect",
    confidence: 0.72,
    x: 720,
    y: 80,
    upstream: ["cn-5"],
    downstream: ["cn-7"],
  },
  {
    id: "cn-7",
    label: "Blue maneuver freedom increased",
    type: "effect",
    confidence: 0.81,
    x: 880,
    y: 100,
    upstream: ["cn-6"],
    downstream: ["cn-8", "cn-9"],
  },
  {
    id: "cn-8",
    label: "Blue strike package inbound",
    type: "action",
    confidence: 0.95,
    x: 1040,
    y: 60,
    upstream: ["cn-7", "cn-4"],
    downstream: ["cn-10"],
  },
  {
    id: "cn-9",
    label: "Mission success probability improves",
    type: "outcome",
    confidence: 0.72,
    x: 1040,
    y: 180,
    upstream: ["cn-7"],
    downstream: [],
  },
  {
    id: "cn-10",
    label: "Red radar site destroyed",
    type: "outcome",
    confidence: 0.87,
    x: 1200,
    y: 60,
    evidence: "BDA imagery",
    upstream: ["cn-8"],
    downstream: ["cn-9"],
  },
];

export const simModules: SimModule[] = [
  {
    id: "mod-uav",
    name: "UAV Recon Module",
    category: "Sensor System",
    type: "MQ-9 Recon",
    status: "active",
    updateRate: "1 Hz",
    range: "150 km",
    detectionProbability: 0.88,
    latency: "2.3 s",
    confidenceModel: "Bayesian fusion",
    inputs: ["GPS", "Weather feed"],
    outputs: ["Target tracks", "Activity reports"],
    validationStatus: "pass",
    x: 80,
    y: 140,
    connections: ["mod-sensor"],
    onCanvas: true,
    description: "Platform reconnaissance and track generation",
    tags: ["blue", "isr"],
  },
  {
    id: "mod-sensor",
    name: "MQ-9 Sensor Suite",
    category: "Sensor System",
    type: "Multi-spectral",
    status: "active",
    updateRate: "5 Hz",
    range: "80 km",
    detectionProbability: 0.91,
    latency: "0.8 s",
    confidenceModel: "SNR-based",
    inputs: ["UAV position"],
    outputs: ["EO/IR detections"],
    validationStatus: "pass",
    x: 280,
    y: 140,
    connections: ["mod-datalink"],
    onCanvas: true,
    tags: ["sensor", "eo-ir"],
  },
  {
    id: "mod-datalink",
    name: "Data Link",
    category: "Data Feed",
    type: "Tactical Link",
    status: "active",
    updateRate: "10 Hz",
    range: "200 km",
    detectionProbability: 1,
    latency: "0.2 s",
    confidenceModel: "N/A",
    inputs: ["Sensor data"],
    outputs: ["C2 updates"],
    validationStatus: "pass",
    x: 480,
    y: 140,
    connections: ["mod-c2"],
    onCanvas: true,
    tags: ["comms"],
  },
  {
    id: "mod-c2",
    name: "C2 Node",
    category: "Command & Control",
    type: "Blue C2",
    status: "active",
    updateRate: "2 Hz",
    range: "N/A",
    detectionProbability: 1,
    latency: "1.5 s",
    confidenceModel: "Decision tree",
    inputs: ["Intel feeds", "COA recommendations"],
    outputs: ["Orders", "Effects requests"],
    validationStatus: "pass",
    x: 680,
    y: 140,
    connections: ["mod-effects"],
    onCanvas: true,
    tags: ["c2", "blue"],
  },
  {
    id: "mod-effects",
    name: "Effects Model",
    category: "Behavior Model",
    type: "Kinetic/Cyber",
    status: "active",
    updateRate: "0.5 Hz",
    range: "Scenario-wide",
    detectionProbability: 0.75,
    latency: "5 s",
    confidenceModel: "Monte Carlo",
    inputs: ["C2 orders"],
    outputs: ["Battle damage", "Causal events"],
    validationStatus: "warn",
    x: 880,
    y: 140,
    connections: [],
    onCanvas: true,
    tags: ["effects", "adjudication"],
  },
  {
    id: "mod-sam",
    name: "SAM Engagement",
    category: "Weapon System",
    type: "IADS / SAM",
    status: "draft",
    updateRate: "2 Hz",
    range: "120 km",
    detectionProbability: 0.82,
    latency: "1.2 s",
    confidenceModel: "PK table",
    inputs: ["Track data", "ROE"],
    outputs: ["Engagement decision", "Miss distance"],
    validationStatus: "warn",
    x: 0,
    y: 0,
    connections: [],
    onCanvas: false,
    description: "Surface-to-air engagement adjudication",
    tags: ["red", "kinetic"],
  },
  {
    id: "mod-ew",
    name: "EW Degradation",
    category: "Cyber Capability",
    type: "Electronic Warfare",
    status: "draft",
    updateRate: "1 Hz",
    range: "Scenario-wide",
    detectionProbability: 0.7,
    latency: "3 s",
    confidenceModel: "Jamming model",
    inputs: ["Emitter list", "Power budget"],
    outputs: ["SNR degradation", "Comms latency"],
    validationStatus: "warn",
    x: 0,
    y: 0,
    connections: [],
    onCanvas: false,
    tags: ["ew", "non-kinetic"],
  },
  {
    id: "mod-weather",
    name: "Maritime Weather",
    category: "Environment",
    type: "Atmosphere / Sea",
    status: "validated",
    updateRate: "0.1 Hz",
    range: "AO-wide",
    detectionProbability: 1,
    latency: "0 s",
    confidenceModel: "Deterministic",
    inputs: ["Scenario clock"],
    outputs: ["Visibility", "Sea state", "Wind"],
    validationStatus: "pass",
    x: 0,
    y: 0,
    connections: [],
    onCanvas: false,
    tags: ["environment"],
  },
  {
    id: "mod-trigger",
    name: "COA Trigger",
    category: "Event / Trigger",
    type: "Threshold event",
    status: "active",
    updateRate: "Event-driven",
    range: "N/A",
    detectionProbability: 1,
    latency: "0.1 s",
    confidenceModel: "Rule engine",
    inputs: ["COA scores", "Event bus"],
    outputs: ["Trigger fired"],
    validationStatus: "pass",
    x: 0,
    y: 0,
    connections: [],
    onCanvas: false,
    tags: ["coa", "automation"],
  },
];

export { moduleCategories } from "../types/moduleCanvas";

export const simulationRuns: SimulationRun[] = [
  {
    id: "RUN-0047",
    scenario: "Scenario Alpha",
    coa: "COA 1 — Seize Initiative",
    status: "running",
    startTime: "15:40:00Z",
    duration: "02:14:38",
    successProbability: 72,
    risk: "medium",
    evidence: "Live stream",
    scenarioVersion: "v2.3.1",
  },
  {
    id: "RUN-0046",
    scenario: "Scenario Alpha",
    coa: "COA 2 — Shape Operations",
    status: "complete",
    startTime: "14:12:00Z",
    duration: "01:45:22",
    successProbability: 61,
    risk: "medium",
    evidence: "Full package",
    scenarioVersion: "v2.3.1",
  },
  {
    id: "RUN-0045",
    scenario: "Scenario Alpha",
    coa: "COA 3 — Deny & Degrade",
    status: "complete",
    startTime: "12:30:00Z",
    duration: "00:52:10",
    successProbability: 48,
    risk: "high",
    evidence: "Full package",
    scenarioVersion: "v2.3.0",
    perturbation: "SAM activation +15 min",
  },
  {
    id: "RUN-0044",
    scenario: "Scenario Alpha",
    coa: "COA 1 — Seize Initiative",
    status: "branch",
    startTime: "11:00:00Z",
    duration: "01:20:00",
    successProbability: 68,
    risk: "medium",
    evidence: "Partial",
    scenarioVersion: "v2.2.8",
    perturbation: "Cyber latency +200ms",
  },
  {
    id: "RUN-0043",
    scenario: "Scenario Alpha",
    coa: "COA 2 — Shape Operations",
    status: "failed",
    startTime: "09:15:00Z",
    duration: "00:38:44",
    successProbability: 34,
    risk: "high",
    evidence: "Failure analysis",
    scenarioVersion: "v2.2.8",
  },
];

export const simulationStatus = {
  status: "Running" as const,
  runTime: "02:14:38",
  dataFreshness: "Live" as const,
};

export const navTabs = [
  { path: "/overview", label: "Overview" },
  { path: "/map", label: "Map" },
  { path: "/coas", label: "COAs" },
  { path: "/causal", label: "Causal" },
  { path: "/modules", label: "Modules" },
  { path: "/runs", label: "Runs" },
  { path: "/cosim", label: "Co-Sim Studio" },
  { path: "/replay-3d", label: "3D Replay", beta: true },
] as const;

export function getCOAById(id: string): COA | undefined {
  return coas.find((c) => c.id === id);
}

export function getEventById(id: string): TimelineEvent | undefined {
  return timelineEvents.find((e) => e.id === id);
}

export function getCausalNodeById(id: string): CausalNode | undefined {
  return causalNodes.find((n) => n.id === id);
}

export function getModuleById(id: string): SimModule | undefined {
  return simModules.find((m) => m.id === id);
}
