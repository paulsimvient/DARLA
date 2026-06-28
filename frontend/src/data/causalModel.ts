import type { CourseOfAction, DashboardData, MapEntity, SimEvent, TemporalCausalEdge } from "../types";
import { formatCausalLabel } from "../utils/coaHelpers";

export type CausalNodeType = "signal" | "inference" | "state" | "action" | "effect" | "outcome";

export type CausalRelation = "increases" | "decreases" | "enables" | "degrades" | "mitigates";

export type CausalNode = {
  id: string;
  type: CausalNodeType;
  label: string;
  subtitle?: string;
  confidence?: number;
  time?: string;
  mapFeatureId?: string;
  detail?: string;
  eventId?: number;
};

export type CausalEdge = {
  id: string;
  source: string;
  target: string;
  relation: CausalRelation;
  weight?: number;
  evidence?: string[];
};

export type CausalGraph = {
  nodes: CausalNode[];
  edges: CausalEdge[];
};

export type CausalSelectionContext = {
  kind: "entity" | "event" | "coa" | "alert";
  id: string;
  title: string;
  subtitle?: string;
  confidence?: number;
  tick?: number;
  coaCount?: number;
};

export type CausalDrilldownMode = "why" | "whatif" | "evidence" | "decision";

/** Demo graph from causal_map_drilldown_demo.html */
export const DEMO_CAUSAL_GRAPH: CausalGraph = {
  nodes: [
    {
      id: "sigint_spike",
      type: "signal",
      label: "SIGINT Spike",
      subtitle: "Observed signal",
      confidence: 0.82,
      detail: "Anomalous RF pattern near the port. Increases likelihood of UAS launch preparation.",
    },
    {
      id: "uas_risk",
      type: "inference",
      label: "UAS Launch Risk",
      subtitle: "Inference node",
      confidence: 0.74,
      detail: "Fuses SIGINT, track history, and route timing into a probabilistic risk estimate.",
    },
    {
      id: "port_congestion",
      type: "effect",
      label: "Port Congestion",
      subtitle: "Operational effect",
      detail: "Predicted operational effect: route compression and increased delay around the port corridor.",
    },
    {
      id: "mission_delay",
      type: "outcome",
      label: "Mission Delay",
      subtitle: "Outcome",
      detail: "Decision outcome: blue ISR and logistics tasks degrade unless a mitigation COA is executed.",
    },
    {
      id: "cyber_alert",
      type: "signal",
      label: "Cyber Alert",
      subtitle: "Observed signal",
      confidence: 0.79,
      detail: "Credential replay attempt detected against logistics coordination node.",
    },
    {
      id: "comms_degraded",
      type: "state",
      label: "Comms Degraded",
      subtitle: "State estimate",
      confidence: 0.58,
      detail: "Compromised or degraded coordination channel reduces confidence in logistics timing.",
    },
    {
      id: "coa_reroute",
      type: "action",
      label: "COA A: Reroute ISR",
      subtitle: "Mitigation action",
      detail: "Shifts ISR path around predicted congestion. Low cyber impact, moderate logistics impact.",
    },
    {
      id: "coa_harden",
      type: "action",
      label: "COA B: Harden Node",
      subtitle: "Mitigation action",
      detail: "Applies cyber hardening to logistics coordination node. Reduces comms degradation confidence.",
    },
  ],
  edges: [
    { id: "e1", source: "sigint_spike", target: "uas_risk", relation: "increases", weight: 0.7 },
    { id: "e2", source: "uas_risk", target: "port_congestion", relation: "increases", weight: 0.6 },
    { id: "e3", source: "port_congestion", target: "mission_delay", relation: "degrades", weight: 0.8 },
    { id: "e4", source: "cyber_alert", target: "comms_degraded", relation: "increases", weight: 0.65 },
    { id: "e5", source: "comms_degraded", target: "port_congestion", relation: "degrades", weight: 0.5 },
    { id: "e6", source: "coa_reroute", target: "mission_delay", relation: "mitigates", weight: 0.5 },
    { id: "e7", source: "coa_harden", target: "comms_degraded", relation: "mitigates", weight: 0.45 },
  ],
};

function inferNodeType(event: SimEvent): CausalNodeType {
  const haystack = `${event.type} ${event.label}`.toLowerCase();
  if (haystack.includes("coa") || haystack.includes("action") || haystack.includes("intervention")) {
    return "action";
  }
  if (haystack.includes("fail") || haystack.includes("success") || haystack.includes("outcome")) {
    return "outcome";
  }
  if (haystack.includes("degrad") || haystack.includes("effect") || haystack.includes("loss")) {
    return "effect";
  }
  if (haystack.includes("detect") || haystack.includes("observ") || haystack.includes("signal")) {
    return "signal";
  }
  return "inference";
}

function relationFromEdge(edge: TemporalCausalEdge): CausalRelation {
  const label = edge.label.toLowerCase();
  if (label.includes("mitig") || label.includes("recover")) return "mitigates";
  if (label.includes("degrad") || label.includes("delay")) return "degrades";
  if (label.includes("enable") || label.includes("support")) return "enables";
  if (label.includes("decreas") || label.includes("reduce")) return "decreases";
  return "increases";
}

function buildFromTemporalGraph(
  events: SimEvent[],
  edges: TemporalCausalEdge[],
  focusEventId?: number,
): CausalGraph {
  const eventById = new Map(events.map((e) => [e.event_id, e]));
  const nodeIds = new Set<number>();

  for (const edge of edges) {
    nodeIds.add(edge.source_event_id);
    nodeIds.add(edge.target_event_id);
  }

  if (focusEventId != null) {
    nodeIds.add(focusEventId);
    for (const edge of edges) {
      if (edge.source_event_id === focusEventId || edge.target_event_id === focusEventId) {
        nodeIds.add(edge.source_event_id);
        nodeIds.add(edge.target_event_id);
      }
    }
  }

  const nodes: CausalNode[] = [...nodeIds]
    .map((eventId) => {
      const event = eventById.get(eventId);
      if (!event) return null;
      return {
        id: `evt-${eventId}`,
        type: inferNodeType(event),
        label: event.label || event.type,
        subtitle: `T+${event.tick}`,
        confidence: event.confidence,
        time: `T+${event.tick}`,
        eventId,
        detail: event.provenance || event.deltas.map((d) => `${d.field}: ${d.before} → ${d.after}`).join("; "),
      } satisfies CausalNode;
    })
    .filter(Boolean) as CausalNode[];

  const nodeIdSet = new Set(nodes.map((n) => n.id));
  const causalEdges: CausalEdge[] = edges
    .filter(
      (e) =>
        nodeIdSet.has(`evt-${e.source_event_id}`) && nodeIdSet.has(`evt-${e.target_event_id}`),
    )
    .map((e, i) => ({
      id: `te-${i}-${e.source_event_id}-${e.target_event_id}`,
      source: `evt-${e.source_event_id}`,
      target: `evt-${e.target_event_id}`,
      relation: relationFromEdge(e),
      weight: e.strength * e.confidence,
      evidence: [e.label, e.type],
    }));

  if (nodes.length === 0) return DEMO_CAUSAL_GRAPH;

  const coas = events.filter((e) => inferNodeType(e) === "action").slice(0, 2);
  for (const coa of coas) {
    const coaNodeId = `evt-${coa.event_id}`;
    if (!nodeIdSet.has(coaNodeId)) continue;
    const outcomes = nodes.filter((n) => n.type === "outcome" || n.type === "effect");
    for (const outcome of outcomes.slice(0, 1)) {
      causalEdges.push({
        id: `coa-${coa.event_id}-${outcome.id}`,
        source: coaNodeId,
        target: outcome.id,
        relation: "mitigates",
        weight: coa.confidence,
      });
    }
  }

  return { nodes, edges: causalEdges };
}

export function buildCausalGraphForEvent(
  event: SimEvent,
  dashboard: DashboardData | null,
  events: SimEvent[],
): CausalGraph {
  const temporal = dashboard?.temporal_causal_graph ?? [];
  if (temporal.length > 0) {
    const related = temporal.filter(
      (e) => e.source_event_id === event.event_id || e.target_event_id === event.event_id,
    );
    const graph = buildFromTemporalGraph(events, related.length > 0 ? related : temporal, event.event_id);
    if (graph.nodes.length > 1) return graph;
  }

  return {
    ...DEMO_CAUSAL_GRAPH,
    nodes: DEMO_CAUSAL_GRAPH.nodes.map((n) =>
      n.id === "sigint_spike"
        ? {
            ...n,
            label: event.label || event.type,
            subtitle: `T+${event.tick}`,
            confidence: event.confidence,
            time: `T+${event.tick}`,
            eventId: event.event_id,
            detail: event.provenance,
          }
        : n,
    ),
  };
}

export function buildCausalGraphForEntity(
  entity: MapEntity,
  dashboard: DashboardData | null,
  events: SimEvent[],
): CausalGraph {
  const relatedEvents = events.filter(
    (e) =>
      e.label.toLowerCase().includes(entity.id.toLowerCase()) ||
      e.provenance.toLowerCase().includes(entity.id.toLowerCase()) ||
      e.deltas.some((d) => d.after.includes(entity.id) || d.before.includes(entity.id)),
  );

  const temporal = dashboard?.temporal_causal_graph ?? [];
  if (relatedEvents.length > 0 && temporal.length > 0) {
    const focus = relatedEvents[relatedEvents.length - 1];
    return buildCausalGraphForEvent(focus, dashboard, events);
  }

  const claims = dashboard?.claims.filter(
    (c) => c.cause_variable.includes(entity.id) || c.effect_variable.includes(entity.id),
  );

  if (claims && claims.length > 0) {
    const nodes: CausalNode[] = claims.flatMap((claim, i) => [
      {
        id: `cause-${i}`,
        type: "signal" as const,
        label: claim.cause_variable,
        subtitle: "Cause",
        confidence: claim.confidence,
        mapFeatureId: entity.id,
        detail: claim.label,
      },
      {
        id: `effect-${i}`,
        type: "effect" as const,
        label: claim.effect_variable,
        subtitle: "Effect",
        confidence: claim.confidence,
        detail: `Status: ${claim.status}`,
      },
    ]);
    const edges: CausalEdge[] = claims.map((_, i) => ({
      id: `claim-${i}`,
      source: `cause-${i}`,
      target: `effect-${i}`,
      relation: "increases" as const,
      weight: claims[i].effect_size,
      evidence: [claims[i].label],
    }));
    return { nodes, edges };
  }

  return {
    ...DEMO_CAUSAL_GRAPH,
    nodes: DEMO_CAUSAL_GRAPH.nodes.map((n) => ({
      ...n,
      mapFeatureId: entity.id,
    })),
  };
}

export function contextFromEntity(entity: MapEntity): CausalSelectionContext {
  return {
    kind: "entity",
    id: entity.id,
    title: entity.id,
    subtitle: `${entity.kind} · ${entity.side}`,
    confidence: entity.sensor_confidence ?? undefined,
  };
}

export function contextFromEvent(event: SimEvent, coaCount = 0): CausalSelectionContext {
  return {
    kind: "event",
    id: String(event.event_id),
    title: event.label || event.type,
    subtitle: event.provenance,
    confidence: event.confidence,
    tick: event.tick,
    coaCount,
  };
}

export function contextFromCoa(coa: CourseOfAction): CausalSelectionContext {
  return {
    kind: "coa",
    id: String(coa.id),
    title: coa.action,
    subtitle: `Target ${coa.target} · ${coa.status}`,
    confidence: coa.causal_confidence,
    tick: coa.proposed_tick,
  };
}

export function buildCausalGraphForCoa(
  coa: CourseOfAction,
  dashboard: DashboardData | null,
  events: SimEvent[],
): CausalGraph {
  const chain = coa.evidence?.dominant_path?.length
    ? coa.evidence.dominant_path
        .filter((node) => node.type !== "action" && node.type !== "outcome")
        .map((node) => node.label)
    : coa.rationale.includes("->")
      ? coa.rationale
          .slice(
            coa.rationale.indexOf(", path ") + 7,
            coa.rationale.indexOf(" for action ") > 0
              ? coa.rationale.indexOf(" for action ")
              : undefined,
          )
          .split("->")
          .map((p) => p.trim())
          .filter(Boolean)
      : [];

  if (chain.length >= 2) {
    const nodes: CausalNode[] = chain.map((label, i) => ({
      id: `chain-${i}`,
      type:
        i === 0 ? "signal" : i === chain.length - 1 ? "effect" : ("inference" as CausalNodeType),
      label: formatCausalLabel(label.replace(/\./g, "")),
      subtitle: i === 0 ? "Observed" : "Inferred",
      confidence: coa.causal_confidence,
    }));

    nodes.push({
      id: "coa-action",
      type: "action",
      label: coa.action,
      subtitle: "Mitigation COA",
      confidence: coa.causal_confidence,
    });
    nodes.push({
      id: "coa-outcome",
      type: "outcome",
      label: "Mission recovery",
      subtitle: `Projected gain ${coa.expected_mission_gain.toFixed(3)}`,
      confidence: coa.score,
    });

    const edges: CausalEdge[] = [];
    for (let i = 0; i < chain.length - 1; i++) {
      edges.push({
        id: `chain-edge-${i}`,
        source: `chain-${i}`,
        target: `chain-${i + 1}`,
        relation: "increases",
        weight: coa.causal_confidence,
      });
    }
    edges.push({
      id: "coa-mitigates",
      source: "coa-action",
      target: "coa-outcome",
      relation: "mitigates",
      weight: coa.expected_mission_gain,
      evidence: [coa.rationale],
    });
    if (chain.length > 0) {
      edges.push({
        id: "coa-breaks",
        source: "coa-action",
        target: `chain-${chain.length - 1}`,
        relation: "mitigates",
        weight: coa.causal_confidence,
      });
    }

    return { nodes, edges };
  }

  const related = events.filter(
    (e) =>
      e.label.toLowerCase().includes(coa.target.toLowerCase()) ||
      e.tick <= coa.proposed_tick,
  );
  const temporal = dashboard?.temporal_causal_graph ?? [];
  if (temporal.length > 0 && related.length > 0) {
    return buildCausalGraphForEvent(related[related.length - 1], dashboard, events);
  }

  return {
    nodes: [
      {
        id: "observed",
        type: "signal",
        label: "Operational degradation",
        subtitle: "Observed branch",
        confidence: coa.causal_confidence,
      },
      {
        id: "effect",
        type: "effect",
        label: "Mission impact",
        subtitle: "Without intervention",
      },
      {
        id: "action",
        type: "action",
        label: coa.action,
        subtitle: coa.status,
        confidence: coa.causal_confidence,
      },
      {
        id: "outcome",
        type: "outcome",
        label: "Projected recovery",
        subtitle: `Gain ${coa.expected_mission_gain.toFixed(3)}`,
        confidence: coa.score,
      },
    ],
    edges: [
      { id: "e1", source: "observed", target: "effect", relation: "increases", weight: coa.risk },
      { id: "e2", source: "action", target: "outcome", relation: "mitigates", weight: coa.score },
      { id: "e3", source: "action", target: "effect", relation: "mitigates", weight: coa.causal_confidence },
    ],
  };
}

export function buildCausalGraphFromDashboard(
  dashboard: DashboardData,
  events: SimEvent[],
  currentTick: number,
): CausalGraph {
  const temporal = dashboard.temporal_causal_graph ?? [];
  const activeEdges =
    temporal.length > 0
      ? temporal.filter(
          (e) => e.valid_from <= currentTick && (e.valid_to === 0 || e.valid_to >= currentTick),
        )
      : [];

  if (activeEdges.length > 0) {
    const graph = buildFromTemporalGraph(events, activeEdges);
    if (graph.nodes.length > 1) return graph;
  }

  if (temporal.length > 0) {
    const graph = buildFromTemporalGraph(events, temporal);
    if (graph.nodes.length > 1) return graph;
  }

  return DEMO_CAUSAL_GRAPH;
}

export function contextFromDashboard(
  dashboard: DashboardData,
  currentTick: number,
): CausalSelectionContext {
  const edgeCount = dashboard.temporal_causal_graph?.length ?? 0;
  return {
    kind: "alert",
    id: dashboard.scenario_id,
    title: "Temporal causal graph",
    subtitle: `${dashboard.scenario_id} · ${edgeCount} edges · tick ${currentTick}`,
    tick: currentTick,
    coaCount: dashboard.coa_log?.length ?? 0,
    confidence: dashboard.causal_debug?.beliefs.sensor_trust,
  };
}
