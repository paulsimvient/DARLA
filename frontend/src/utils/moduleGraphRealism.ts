import type { CourseOfAction, DashboardData, MapEntity, RelationshipEdge, SimEvent } from "../types";
import type { SimModule } from "../types/moduleCanvas";

export type ModuleHealth = "nominal" | "degraded" | "compromised" | "intervention" | "unknown";
export type ModuleProvenance = "synthetic" | "sim-derived" | "fmu-stub" | "python-scripted" | "open-data" | "live-feed";

export type ModuleRuntimeState = {
  health: ModuleHealth;
  risk: "low" | "medium" | "high";
  provenance: ModuleProvenance;
  stateBadges: string[];
  operationalRole: string;
  currentRelevance: string;
  causalRole: string;
  availableActions: string[];
  modelCard: {
    modelType: string;
    inputs: string[];
    outputs: string[];
    validity: string;
    limitations: string[];
  };
  recentChanges: string[];
};

export type ActiveCausalChain = {
  nodes: string[];
  confidence: number;
  recommendedAction?: string;
  summary: string;
};

export type RunModuleSummary = {
  outcome: string;
  primaryCausalPath: string;
  bestCoa: string;
  estimatedImprovement: string;
  evidenceConfidence: string;
};

export function relationshipLabel(type: string): string {
  return type.replace(/_/g, " ");
}

export function relationshipClass(type: string): { stroke: string; labelClass: string } {
  const normalized = type.toLowerCase();
  if (normalized.includes("degrade") || normalized.includes("attack") || normalized.includes("cyber")) {
    return { stroke: "#f97316", labelClass: "border-orange-800 bg-orange-950/80 text-orange-300" };
  }
  if (normalized.includes("command") || normalized.includes("control")) {
    return { stroke: "#60a5fa", labelClass: "border-blue-800 bg-blue-950/80 text-blue-300" };
  }
  if (normalized.includes("sense") || normalized.includes("detect")) {
    return { stroke: "#22d3ee", labelClass: "border-cyan-800 bg-cyan-950/80 text-cyan-300" };
  }
  if (normalized.includes("support") || normalized.includes("supply") || normalized.includes("depend")) {
    return { stroke: "#a78bfa", labelClass: "border-violet-800 bg-violet-950/80 text-violet-300" };
  }
  if (normalized.includes("protect") || normalized.includes("defend")) {
    return { stroke: "#34d399", labelClass: "border-emerald-800 bg-emerald-950/80 text-emerald-300" };
  }
  return { stroke: "#71717a", labelClass: "border-zinc-700 bg-zinc-900/90 text-zinc-300" };
}

export function moduleHealthTone(health: ModuleHealth): string {
  switch (health) {
    case "nominal":
      return "border-emerald-700/70 bg-emerald-950/30";
    case "degraded":
      return "border-amber-700/70 bg-amber-950/30";
    case "compromised":
      return "border-red-700/70 bg-red-950/30";
    case "intervention":
      return "border-blue-700/70 bg-blue-950/30";
    default:
      return "border-darla-border bg-darla-panel";
  }
}

export function moduleHealthAccent(health: ModuleHealth): string {
  switch (health) {
    case "nominal":
      return "#22c55e";
    case "degraded":
      return "#f59e0b";
    case "compromised":
      return "#ef4444";
    case "intervention":
      return "#38bdf8";
    default:
      return "#71717a";
  }
}

export function deriveModuleRuntimeState(
  module: SimModule,
  entities: MapEntity[],
  relationships: RelationshipEdge[],
  dashboard: DashboardData | null,
  currentTick: number,
): ModuleRuntimeState {
  const entity = entities.find((item) => item.id === module.id);
  const incoming = relationships.filter((edge) => edge.target === module.id);
  const outgoing = relationships.filter((edge) => edge.source === module.id);
  const events = dashboard?.events ?? [];
  const activeCoa = (dashboard?.coa_log ?? []).find((coa) => coa.target === module.id && coa.status !== "rejected");
  const health = inferHealth(module, entity, incoming, events, activeCoa);
  const risk = inferRisk(module, health, dashboard);
  const provenance = inferProvenance(module, dashboard);
  const stateBadges = buildStateBadges(module, entity, health, dashboard);

  return {
    health,
    risk,
    provenance,
    stateBadges,
    operationalRole: operationalRoleFor(module),
    currentRelevance: currentRelevanceFor(module, health, dashboard),
    causalRole: causalRoleFor(module, incoming, outgoing, dashboard),
    availableActions: availableActionsFor(module, health),
    modelCard: {
      modelType: modelTypeFor(module, provenance),
      inputs: module.inputs.slice(0, 4),
      outputs: module.outputs.slice(0, 4),
      validity: validityFor(module, provenance),
      limitations: limitationsFor(module, provenance),
    },
    recentChanges: recentChangesFor(module, events, currentTick),
  };
}

function inferHealth(
  module: SimModule,
  entity: MapEntity | undefined,
  incoming: RelationshipEdge[],
  events: SimEvent[],
  activeCoa: CourseOfAction | undefined,
): ModuleHealth {
  if (activeCoa?.action?.includes("isolate") || entity?.sensor_isolated) return "intervention";
  if (entity?.sensor_degraded || module.latency.toLowerCase().includes("degraded")) return "degraded";
  if (module.id.toLowerCase().includes("red_cyber")) return "compromised";
  if (incoming.some((edge) => edge.type.toLowerCase().includes("degrade"))) {
    const hasCyberEvent = events.some((event) => event.label.toLowerCase().includes("cyber") && event.tick > 0);
    if (hasCyberEvent) return "degraded";
  }
  if (entity?.sensor_confidence != null && entity.sensor_confidence >= 0.7) return "nominal";
  if (module.validationStatus === "pass") return "nominal";
  return "unknown";
}

function inferRisk(module: SimModule, health: ModuleHealth, dashboard: DashboardData | null): "low" | "medium" | "high" {
  if (health === "compromised") return "high";
  if (health === "degraded") return "high";
  if (module.category === "Command & Control" && dashboard?.online_metrics?.mission_success === false) return "medium";
  if (module.category === "Cyber Capability") return "medium";
  return "low";
}

function inferProvenance(module: SimModule, dashboard: DashboardData | null): ModuleProvenance {
  if (dashboard?.open_data?.data_mode === "open_data") return "open-data";
  if (dashboard?.fmu_runtime?.some((fmu) => fmu.id.includes(module.id))) return "fmu-stub";
  if (dashboard?.python_scripts?.some((script) => script.object_id === module.id)) return "python-scripted";
  return "sim-derived";
}

function buildStateBadges(
  module: SimModule,
  entity: MapEntity | undefined,
  health: ModuleHealth,
  dashboard: DashboardData | null,
): string[] {
  const badges: string[] = [health];
  if (entity?.sensor_confidence != null) badges.push(`conf ${entity.sensor_confidence.toFixed(2)}`);
  if (entity?.sensor_range_km) badges.push(`${entity.sensor_range_km} km sensor`);
  if (module.category === "Cyber Capability") badges.push("cyber");
  if ((dashboard?.coa_log ?? []).some((coa) => coa.target === module.id)) badges.push("COA target");
  return badges.slice(0, 4);
}

function operationalRoleFor(module: SimModule): string {
  if (module.category === "Command & Control") {
    return "Coordinates mission decisions, consumes detection reports, and selects or approves COAs.";
  }
  if (module.category === "Sensor System") {
    return "Provides ISR observation state and detection confidence used by the mission decision loop.";
  }
  if (module.category === "Cyber Capability") {
    if (module.id.toLowerCase().includes("red")) {
      return "Represents adversary cyber capability that can degrade mission-relevant data paths.";
    }
    return "Represents defensive cyber capability that can detect, isolate, or recover compromised paths.";
  }
  if (module.category === "Infrastructure") {
    return "Supports the mission through communications, logistics, or relay dependencies.";
  }
  return "Participates in the synthetic mission state and contributes to downstream events.";
}

function currentRelevanceFor(module: SimModule, health: ModuleHealth, dashboard: DashboardData | null): string {
  const claims = dashboard?.claims ?? [];
  const relevantClaim = claims.find(
    (claim) => claim.cause_variable.includes(module.id) || claim.effect_variable.includes(module.id),
  );
  if (relevantClaim) {
    return `Part of causal claim “${relevantClaim.label}” with ${(relevantClaim.confidence * 100).toFixed(0)}% confidence.`;
  }
  if (health === "degraded") return "Operationally relevant because this node is degraded during the replayed run.";
  if (health === "compromised") return "Threat-relevant because this node represents adversary cyber leverage.";
  return "No active causal warning is attached to this node at the current replay tick.";
}

function causalRoleFor(
  module: SimModule,
  incoming: RelationshipEdge[],
  outgoing: RelationshipEdge[],
  dashboard: DashboardData | null,
): string {
  const claim = (dashboard?.claims ?? []).find(
    (item) => item.cause_variable.includes(module.id) || item.effect_variable.includes(module.id),
  );
  if (claim) {
    return `Runtime claim participant: ${claim.cause_variable} → ${claim.effect_variable}.`;
  }
  if (incoming.some((edge) => edge.type.toLowerCase().includes("degrade"))) {
    return "Likely effect node: receives a degrading relationship from an upstream cyber/threat actor.";
  }
  if (outgoing.some((edge) => edge.type.toLowerCase().includes("degrade"))) {
    return "Likely cause/intervention node: can drive downstream degradation in the scenario graph.";
  }
  if (outgoing.length > 0) return "Upstream dependency node: changes here can propagate to downstream mission entities.";
  return "Terminal or observation node in the current module graph.";
}

function availableActionsFor(module: SimModule, health: ModuleHealth): string[] {
  if (module.category === "Cyber Capability" && !module.id.toLowerCase().includes("red")) {
    return ["inspect causal evidence", "test cyber-defense intervention", "isolate compromised feed"];
  }
  if (module.category === "Sensor System" || module.id.toLowerCase().includes("uas")) {
    return ["run counterfactual from node", "show downstream effects", "compare recovery branch"];
  }
  if (health === "degraded") {
    return ["show upstream causes", "run recovery counterfactual", "open realism gates"];
  }
  return ["show upstream causes", "show downstream effects", "inspect model card"];
}

function modelTypeFor(module: SimModule, provenance: ModuleProvenance): string {
  if (provenance === "fmu-stub") return "FMU-backed analytical stub";
  if (provenance === "python-scripted") return "Python behavior model";
  if (module.category === "Cyber Capability") return "Synthetic cyber-service model";
  if (module.category === "Sensor System") return "Synthetic sensor/detection model";
  if (module.category === "Command & Control") return "Agentic commander decision model";
  return "Scenario entity state model";
}

function validityFor(module: SimModule, provenance: ModuleProvenance): string {
  if (provenance === "open-data") return "Open-data calibrated scenario context; operational decisions remain synthetic.";
  if (module.category === "Sensor System") return "Valid inside maritime ISR synthetic scenario with simplified sensing and confidence dynamics.";
  if (module.category === "Cyber Capability") return "Valid for cyber-effect reasoning, not detailed exploit-chain emulation.";
  return "Valid inside the loaded DARLA synthetic mission scenario.";
}

function limitationsFor(module: SimModule, provenance: ModuleProvenance): string[] {
  const base = ["Not live operational telemetry", "Scenario-scale synthetic model"];
  if (provenance === "fmu-stub") return [...base, "FMU behavior may be analytical stub rather than external FMU archive"];
  if (module.category === "Cyber Capability") return [...base, "Cyber effects are mission-level abstractions"];
  if (module.category === "Sensor System") return [...base, "Sensor physics simplified to confidence/range dynamics"];
  return base;
}

function recentChangesFor(module: SimModule, events: SimEvent[], currentTick: number): string[] {
  const lowerId = module.id.toLowerCase();
  const changes = events
    .filter((event) => event.tick <= currentTick)
    .filter((event) => {
      const text = `${event.label} ${event.deltas.map((delta) => `${delta.field} ${delta.before} ${delta.after}`).join(" ")}`.toLowerCase();
      return text.includes(lowerId) || lowerId.split("_").some((piece) => piece.length > 3 && text.includes(piece));
    })
    .slice(-4)
    .map((event) => `T+${event.tick}: ${event.label.replace(/_/g, " ")}`);
  return changes.length > 0 ? changes : ["No node-specific changes in the current replay window."];
}

export function buildActiveCausalChain(dashboard: DashboardData | null, coas: CourseOfAction[]): ActiveCausalChain {
  const strongestClaim = [...(dashboard?.claims ?? [])].sort((a, b) => b.confidence - a.confidence)[0];
  const bestCoa = [...coas].sort((a, b) => b.score - a.score)[0];

  if (strongestClaim) {
    const nodes = [
      strongestClaim.cause_variable.replace(/_/g, " "),
      strongestClaim.effect_variable.replace(/_/g, " "),
      "mission outcome",
    ];
    if (bestCoa) nodes.push(bestCoa.action.replace(/_/g, " "));
    return {
      nodes,
      confidence: strongestClaim.confidence,
      recommendedAction: bestCoa?.action.replace(/_/g, " "),
      summary: strongestClaim.label.replace(/_/g, " "),
    };
  }

  return {
    nodes: ["red cyber actor", "UAS sensor degradation", "target detection delay", "mission success risk"],
    confidence: dashboard?.async_validation?.falsification_survived ? 0.72 : 0.55,
    recommendedAction: bestCoa?.action.replace(/_/g, " "),
    summary: "Scenario causal chain inferred from module relationships and run events.",
  };
}

export function buildRunModuleSummary(dashboard: DashboardData | null, coas: CourseOfAction[]): RunModuleSummary {
  const bestCoa = [...coas].sort((a, b) => b.score - a.score)[0];
  const strongestClaim = [...(dashboard?.claims ?? [])].sort((a, b) => b.confidence - a.confidence)[0];
  const missionScore = dashboard?.online_metrics?.mission_success_score;
  return {
    outcome: dashboard?.online_metrics?.mission_success
      ? `Mission success · score ${missionScore?.toFixed(2) ?? "—"}`
      : `Mission degraded · score ${missionScore?.toFixed(2) ?? "—"}`,
    primaryCausalPath: strongestClaim
      ? `${strongestClaim.cause_variable} → ${strongestClaim.effect_variable}`.replace(/_/g, " ")
      : "red cyber → sensor confidence → detection delay",
    bestCoa: bestCoa ? bestCoa.action.replace(/_/g, " ") : "No COA selected",
    estimatedImprovement: bestCoa ? `+${(bestCoa.expected_mission_gain * 100).toFixed(0)}% mission gain` : "No branch estimate",
    evidenceConfidence: strongestClaim ? `${(strongestClaim.confidence * 100).toFixed(0)}% claim confidence` : "Medium synthetic confidence",
  };
}
