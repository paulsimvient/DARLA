import type { CausalEdge, CausalGraph, CausalNode, CausalNodeType, CausalRelation } from "../data/causalModel";
import type {
  BranchResult,
  CausalClaim,
  CourseOfAction,
  DashboardData,
  RelationshipEdge,
  SimEvent,
  TemporalCausalEdge,
} from "../types";
import type {
  BranchOutcomeDistribution,
  RunUncertaintyMetric,
  RuntimeCausalEdgeEvidence,
} from "../realism/types";

export type AccurateCausalGraphMode = "causal" | "counterfactual";

export type ConfidenceTone = "red" | "orange" | "green" | "blue";

export type ConfidenceStatus = {
  badge: string;
  label: string;
  tone: ConfidenceTone;
  reportable: boolean;
  guidance: string;
};

export type CausalAccuracySummary = {
  confidence: number;
  confidenceStatus: ConfidenceStatus;
  nodeCount: number;
  edgeCount: number;
  evidenceItemCount: number;
  runtimeEdgeCount: number;
  causalClaimCount: number;
  counterfactualCount: number;
  topExplanation: string;
  warnings: string[];
  reportability: "reportable" | "needs_review" | "weak" | "insufficient";
};

export type AccurateCausalGraphInput = {
  dashboard: DashboardData | null;
  events: SimEvent[];
  currentTick: number;
  relationships: RelationshipEdge[];
  runtimeEdges: RuntimeCausalEdgeEvidence[];
  claims: CausalClaim[];
  coas: CourseOfAction[];
  branchResults: BranchResult[];
  branchComparisons: BranchOutcomeDistribution[];
  uncertaintyBands: RunUncertaintyMetric[];
  temporalEdges: TemporalCausalEdge[];
  mode: AccurateCausalGraphMode;
};

function clamp01(value: number | undefined | null): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function formatPercent(value: number | undefined | null): string {
  return `${Math.round(clamp01(value) * 100)}%`;
}

export function confidenceStatus(value: number | undefined | null): ConfidenceStatus {
  const confidence = clamp01(value);
  if (confidence < 0.4) {
    return {
      badge: `${formatPercent(confidence)} · weak`,
      label: "Weak causal support",
      tone: "red",
      reportable: false,
      guidance: "Do not present as a causal finding; collect more evidence or run counterfactual/falsification checks.",
    };
  }
  if (confidence < 0.7) {
    return {
      badge: `${formatPercent(confidence)} · medium / review`,
      label: "Medium causal support",
      tone: "orange",
      reportable: false,
      guidance: "Treat as a supported causal hypothesis, not a definitive claim. Human review recommended.",
    };
  }
  if (confidence < 0.85) {
    return {
      badge: `${formatPercent(confidence)} · strong`,
      label: "Strong causal support",
      tone: "green",
      reportable: true,
      guidance: "Reportable if the model validity envelope applies and major confounders were checked.",
    };
  }
  return {
    badge: `${formatPercent(confidence)} · high`,
    label: "High causal support",
    tone: "blue",
    reportable: true,
    guidance: "High-confidence runtime causal claim, still bounded by scenario/model validity assumptions.",
  };
}

function humanizeVariable(value: string): string {
  return value
    .replace(/^evt-/, "")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/Uas/g, "UAS")
    .replace(/Coa/g, "COA");
}

function stableId(prefix: string, raw: string): string {
  return `${prefix}-${raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "node"}`;
}

function inferNodeType(variable: string): CausalNodeType {
  const text = variable.toLowerCase();
  if (text.includes("coa") || text.includes("action") || text.includes("intervention") || text.includes("isolate")) {
    return "action";
  }
  if (text.includes("mission") || text.includes("success") || text.includes("risk")) return "outcome";
  if (text.includes("detect") || text.includes("target")) return "effect";
  if (text.includes("sensor") || text.includes("comms") || text.includes("relay") || text.includes("confidence")) return "state";
  if (text.includes("cyber") || text.includes("weather") || text.includes("logistics")) return "signal";
  return "inference";
}

function inferRelation(source: string, target: string, preferred?: string): CausalRelation {
  const text = `${source} ${target} ${preferred ?? ""}`.toLowerCase();
  if (text.includes("mitig") || text.includes("recover") || text.includes("isolate")) return "mitigates";
  if (text.includes("degrad") || text.includes("delay") || text.includes("risk") || text.includes("loss")) return "degrades";
  if (text.includes("enable") || text.includes("support")) return "enables";
  if (text.includes("reduce") || text.includes("decrease")) return "decreases";
  return "increases";
}

function addVariableNode(nodes: Map<string, CausalNode>, variable: string, detail?: string, confidence?: number): string {
  const id = stableId("var", variable);
  const prior = nodes.get(id);
  const nextConfidence = clamp01(confidence ?? prior?.confidence ?? 0.5);
  const node: CausalNode = {
    id,
    type: inferNodeType(variable),
    label: humanizeVariable(variable),
    subtitle: prior?.subtitle ?? "Runtime variable / event",
    confidence: Math.max(prior?.confidence ?? 0, nextConfidence),
    detail: [prior?.detail, detail].filter(Boolean).join("\n\n"),
  };
  nodes.set(id, node);
  return id;
}

function eventText(event: SimEvent): string {
  const deltas = event.deltas?.slice(0, 3).map((delta) => `${delta.field}: ${delta.before} → ${delta.after}`).join("; ");
  return [event.label || event.type, deltas, event.provenance].filter(Boolean).join(" · ");
}

function buildFromRuntimeEdges(input: AccurateCausalGraphInput): CausalGraph | null {
  if (!input.runtimeEdges.length) return null;

  const nodes = new Map<string, CausalNode>();
  const eventById = new Map(input.events.map((event) => [event.event_id, event]));
  const edges: CausalEdge[] = [];

  input.runtimeEdges.slice(0, 12).forEach((edge, index) => {
    const confidence = clamp01(edge.totalScore);
    const evidence = [
      edge.explanation,
      `Temporal precedence ${formatPercent(edge.temporalPrecedence)}`,
      `State-delta support ${formatPercent(edge.stateDeltaSupport)}`,
      `Counterfactual support ${formatPercent(edge.counterfactualSupport)}`,
      `Confounding penalty ${formatPercent(edge.confoundingPenalty)}`,
      ...edge.supportingEventIds
        .map((id) => eventById.get(id))
        .filter(Boolean)
        .slice(0, 4)
        .map((event) => `T+${event!.tick}: ${eventText(event!)}`),
    ].filter(Boolean);

    const sourceId = addVariableNode(
      nodes,
      edge.source,
      `Role: proposed cause.\nRuntime evidence score: ${formatPercent(confidence)}.\n${evidence.join("\n")}`,
      confidence,
    );
    const targetId = addVariableNode(
      nodes,
      edge.target,
      `Role: proposed effect/outcome.\nRuntime evidence score: ${formatPercent(confidence)}.`,
      confidence,
    );

    edges.push({
      id: `runtime-edge-${index}-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      relation: inferRelation(edge.source, edge.target, edge.explanation),
      weight: confidence,
      evidence,
    });
  });

  return { nodes: [...nodes.values()], edges };
}

function buildFromClaims(input: AccurateCausalGraphInput): CausalGraph | null {
  if (!input.claims.length) return null;

  const nodes = new Map<string, CausalNode>();
  const edges: CausalEdge[] = [];

  input.claims.slice(0, 12).forEach((claim, index) => {
    const confidence = clamp01(claim.confidence);
    const sourceId = addVariableNode(
      nodes,
      claim.cause_variable,
      `Claim: ${claim.label}\nStatus: ${claim.status}\nEffect size: ${claim.effect_size.toFixed(3)}`,
      confidence,
    );
    const targetId = addVariableNode(
      nodes,
      claim.effect_variable,
      `Effect variable for claim: ${claim.label}\nStatus: ${claim.status}`,
      confidence,
    );
    edges.push({
      id: `claim-edge-${index}-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      relation: claim.effect_size < 0 ? "decreases" : inferRelation(claim.cause_variable, claim.effect_variable, claim.label),
      weight: Math.abs(claim.effect_size) > 1 ? confidence : clamp01(Math.max(confidence, Math.abs(claim.effect_size))),
      evidence: [claim.label, `Status: ${claim.status}`, `Confidence: ${formatPercent(confidence)}`],
    });
  });

  return { nodes: [...nodes.values()], edges };
}

function buildFromTemporalEvents(input: AccurateCausalGraphInput): CausalGraph | null {
  if (!input.temporalEdges.length || !input.events.length) return null;

  const byEventId = new Map(input.events.map((event) => [event.event_id, event]));
  const nodes = new Map<string, CausalNode>();
  const edges: CausalEdge[] = [];

  input.temporalEdges.slice(0, 16).forEach((edge, index) => {
    const source = byEventId.get(edge.source_event_id);
    const target = byEventId.get(edge.target_event_id);
    if (!source || !target) return;

    const sourceVar = source.deltas?.[0]?.field || source.label || source.type;
    const targetVar = target.deltas?.[0]?.field || target.label || target.type;
    const confidence = clamp01(edge.strength * edge.confidence);
    const sourceId = addVariableNode(
      nodes,
      sourceVar,
      `Event T+${source.tick}: ${eventText(source)}`,
      source.confidence,
    );
    const targetId = addVariableNode(
      nodes,
      targetVar,
      `Event T+${target.tick}: ${eventText(target)}`,
      target.confidence,
    );
    edges.push({
      id: `temporal-edge-${index}-${edge.source_event_id}-${edge.target_event_id}`,
      source: sourceId,
      target: targetId,
      relation: inferRelation(sourceVar, targetVar, edge.label),
      weight: confidence,
      evidence: [edge.label, edge.type, `source event ${edge.source_event_id}`, `target event ${edge.target_event_id}`],
    });
  });

  if (!nodes.size) return null;
  return { nodes: [...nodes.values()], edges };
}

function buildCounterfactualGraph(input: AccurateCausalGraphInput): CausalGraph {
  const nodes = new Map<string, CausalNode>();
  const edges: CausalEdge[] = [];

  const baselineId = addVariableNode(
    nodes,
    "baseline mission trajectory",
    "Baseline branch without the selected or recommended intervention.",
    0.65,
  );

  const outcomeId = addVariableNode(
    nodes,
    "mission outcome distribution",
    "Outcome node comparing baseline and intervention branches.",
    0.65,
  );

  const branchSources = input.branchComparisons.length
    ? input.branchComparisons.slice(0, 6).map((branch) => ({
        id: branch.branchId,
        label: branch.label,
        gain: branch.missionSuccessProbability.mean,
        confidence: branch.missionSuccessProbability.confidence,
        detail: `Mission success probability ${formatPercent(branch.missionSuccessProbability.mean)}; 90% interval ${formatPercent(branch.missionSuccessProbability.lower90)}–${formatPercent(branch.missionSuccessProbability.upper90)}; downside risk ${formatPercent(branch.downsideRisk.mean)}.`,
      }))
    : input.branchResults.slice(0, 6).map((branch) => ({
        id: branch.branch_id,
        label: branch.action || branch.branch_id,
        gain: branch.mission_delta,
        confidence: clamp01(0.55 + Math.abs(branch.mission_delta)),
        detail: `Mission delta ${branch.mission_delta.toFixed(3)}; detection-time delta ${branch.detection_time_delta}; risk delta ${branch.risk_delta.toFixed(3)}.`,
      }));

  if (branchSources.length === 0) {
    input.coas.slice(0, 4).forEach((coa) => {
      branchSources.push({
        id: String(coa.id),
        label: coa.action,
        gain: coa.expected_mission_gain,
        confidence: coa.causal_confidence,
        detail: `Projected COA gain ${coa.expected_mission_gain.toFixed(3)}; status ${coa.status}; target ${coa.target}.`,
      });
    });
  }

  edges.push({
    id: "baseline-to-outcome",
    source: baselineId,
    target: outcomeId,
    relation: "degrades",
    weight: 0.55,
    evidence: ["Baseline provides the comparison condition for intervention branches."],
  });

  branchSources.forEach((branch, index) => {
    const interventionId = addVariableNode(nodes, `intervention ${branch.label}`, branch.detail, branch.confidence);
    const relation: CausalRelation = branch.gain >= 0 ? "mitigates" : "degrades";
    edges.push({
      id: `counterfactual-${index}-${interventionId}`,
      source: interventionId,
      target: outcomeId,
      relation,
      weight: clamp01(branch.confidence || Math.abs(branch.gain)),
      evidence: [branch.detail],
    });
  });

  if (branchSources.length === 0) {
    const missingId = addVariableNode(
      nodes,
      "no counterfactual branches available",
      "Run or export branch comparisons before treating this as a counterfactual result.",
      0.2,
    );
    edges.push({
      id: "missing-counterfactual-edge",
      source: baselineId,
      target: missingId,
      relation: "enables",
      weight: 0.2,
      evidence: ["No branch comparisons were emitted for this run."],
    });
  }

  return { nodes: [...nodes.values()], edges };
}

function insufficientGraph(input: AccurateCausalGraphInput): CausalGraph {
  const node: CausalNode = {
    id: "insufficient-causal-evidence",
    type: "inference",
    label: "Insufficient Causal Evidence",
    subtitle: `T+${input.currentTick}`,
    confidence: 0.2,
    detail:
      "No runtime causal edges, causal claims, or temporal event edges were available. Run the simulation and inspect Realism → Evidence before presenting causal findings.",
  };
  return { nodes: [node], edges: [] };
}

export function buildAccurateCausalGraph(input: AccurateCausalGraphInput): CausalGraph {
  if (input.mode === "counterfactual") return buildCounterfactualGraph(input);
  return (
    buildFromRuntimeEdges(input) ??
    buildFromClaims(input) ??
    buildFromTemporalEvents(input) ??
    insufficientGraph(input)
  );
}

function countEvidenceItems(graph: CausalGraph): number {
  return graph.edges.reduce((sum, edge) => sum + (edge.evidence?.length ?? 0), 0);
}

function averageConfidence(values: number[]): number {
  const filtered = values.map(clamp01).filter((value) => value > 0);
  if (!filtered.length) return 0.2;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

export function buildCausalAccuracySummary(input: AccurateCausalGraphInput): CausalAccuracySummary {
  const graph = buildAccurateCausalGraph(input);
  const edgeConfidence = graph.edges.map((edge) => edge.weight ?? 0);
  const nodeConfidence = graph.nodes.map((node) => node.confidence ?? 0);
  const runtimeConfidence = input.runtimeEdges.map((edge) => edge.totalScore);
  const claimConfidence = input.claims.map((claim) => claim.confidence);
  const confidence = averageConfidence([...edgeConfidence, ...runtimeConfidence, ...claimConfidence, ...nodeConfidence]);
  const status = confidenceStatus(confidence);
  const warnings: string[] = [];

  if (confidence < 0.7) warnings.push("Medium/weak causal confidence; do not present as definitive causal truth.");
  if (input.runtimeEdges.length === 0) warnings.push("No Run Evidence API runtime causal edges available; using claims/events fallback.");
  if (input.branchComparisons.length === 0 && input.branchResults.length === 0) {
    warnings.push("No counterfactual branch comparisons available for this view.");
  }
  if (input.uncertaintyBands.length === 0) warnings.push("No uncertainty bands were attached to the causal graph input.");

  const reportability: CausalAccuracySummary["reportability"] =
    graph.edges.length === 0
      ? "insufficient"
      : confidence < 0.4
        ? "weak"
        : confidence < 0.7
          ? "needs_review"
          : "reportable";

  const topExplanation =
    reportability === "reportable"
      ? "Runtime evidence supports a reportable causal hypothesis inside the current model envelope."
      : reportability === "needs_review"
        ? "Runtime evidence supports a plausible causal hypothesis, but confidence is medium and needs review."
        : reportability === "weak"
          ? "Causal support is weak; treat this as an exploratory pattern."
          : "Insufficient causal evidence has been emitted for this run.";

  return {
    confidence,
    confidenceStatus: status,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    evidenceItemCount: countEvidenceItems(graph),
    runtimeEdgeCount: input.runtimeEdges.length,
    causalClaimCount: input.claims.length,
    counterfactualCount: input.branchComparisons.length + input.branchResults.length,
    topExplanation,
    warnings,
    reportability,
  };
}
