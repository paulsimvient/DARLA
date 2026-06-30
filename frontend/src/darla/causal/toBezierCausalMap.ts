import type { CausalMapEdge, CausalMapNode } from "./BezierCausalMap";

type AnyRecord = Record<string, any>;

const columns = {
  observation: 40,
  belief: 285,
  cause: 520,
  effect: 755,
  decision: 985,
};

function typeForNode(id: string, label: string): CausalMapNode["type"] {
  const value = `${id} ${label}`.toLowerCase();

  if (value.includes("observe") || value.includes("event") || value.includes("sensor")) return "observation";
  if (value.includes("belief") || value.includes("confidence")) return "belief";
  if (value.includes("cyber") || value.includes("threat") || value.includes("red")) return "cause";
  if (value.includes("effect") || value.includes("degrad") || value.includes("detection")) return "effect";
  if (value.includes("coa") || value.includes("decision") || value.includes("recommend") || value.includes("action")) return "decision";

  return "belief";
}

function columnFor(type: CausalMapNode["type"]): number {
  if (type === "observation") return columns.observation;
  if (type === "belief") return columns.belief;
  if (type === "cause" || type === "threat") return columns.cause;
  if (type === "effect") return columns.effect;
  if (type === "decision" || type === "action") return columns.decision;
  return columns.belief;
}

/**
 * Builds a readable left-to-right causal map from existing dashboard JSON.
 * Prefer feeding explicit nodes/edges if your export already has them.
 */
export function toBezierCausalMap(raw: AnyRecord): {
  nodes: CausalMapNode[];
  edges: CausalMapEdge[];
} {
  const explicitNodes = raw?.causal_map?.nodes ?? raw?.causal_nodes ?? raw?.graph?.nodes;
  const explicitEdges = raw?.causal_map?.edges ?? raw?.causal_edges ?? raw?.graph?.edges;

  if (Array.isArray(explicitNodes) && Array.isArray(explicitEdges)) {
    const groupedCounts = new Map<string, number>();

    const nodes = explicitNodes.map((n: AnyRecord) => {
      const id = String(n.id ?? n.key ?? n.label);
      const label = String(n.label ?? n.name ?? id);
      const type = (n.type ?? typeForNode(id, label)) as CausalMapNode["type"];
      const count = groupedCounts.get(type ?? "belief") ?? 0;
      groupedCounts.set(type ?? "belief", count + 1);

      return {
        id,
        label,
        type,
        x: typeof n.x === "number" ? n.x : columnFor(type),
        y: typeof n.y === "number" ? n.y : 70 + count * 92,
      };
    });

    const edges = explicitEdges.map((e: AnyRecord, i: number) => ({
      id: String(e.id ?? `edge_${i}`),
      source: String(e.source ?? e.from),
      target: String(e.target ?? e.to),
      label: e.label ?? e.relation ?? e.type,
      relation: e.relation ?? e.type,
      confidence: typeof e.confidence === "number" ? e.confidence : undefined,
    }));

    return { nodes, edges };
  }

  // Fallback for Phase G evidence package.
  const assumptions = raw?.evidence_package?.causal_assumptions ?? raw?.causal_assumptions ?? [];
  const actions = raw?.evidence_package?.candidate_actions ?? raw?.candidate_actions ?? [];

  const nodeMap = new Map<string, CausalMapNode>();
  const edges: CausalMapEdge[] = [];

  function addNode(id: string, label = id) {
    if (nodeMap.has(id)) return;
    const type = typeForNode(id, label);
    const sameColumn = [...nodeMap.values()].filter((n) => n.type === type).length;
    nodeMap.set(id, {
      id,
      label,
      type,
      x: columnFor(type),
      y: 70 + sameColumn * 92,
    });
  }

  for (const a of assumptions) {
    const source = String(a.source ?? "unknown_source");
    const target = String(a.target ?? "unknown_target");
    addNode(source);
    addNode(target);
    edges.push({
      id: `${source}_${target}`,
      source,
      target,
      label: String(a.relation ?? "causes"),
      confidence: typeof a.confidence === "number" ? a.confidence : undefined,
    });
  }

  for (const action of actions) {
    const id = String(action.id ?? action.action_id ?? "coa");
    addNode(id, String(action.label ?? id));
    const prior = [...nodeMap.values()].find((n) => n.type === "effect") ?? [...nodeMap.values()][0];
    if (prior) {
      edges.push({
        id: `${prior.id}_${id}`,
        source: prior.id,
        target: id,
        label: "supports",
        confidence: typeof action.expected_gain === "number" ? action.expected_gain : undefined,
      });
    }
  }

  return {
    nodes: [...nodeMap.values()],
    edges,
  };
}
