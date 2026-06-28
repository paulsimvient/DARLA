import type { CausalGraph, CausalNodeType, CausalRelation } from "../data/causalModel";
import type { CausalSubgraph, CourseOfAction } from "../types";
import { formatCausalLabel } from "./coaHelpers";

function pathNodeType(type: string): CausalNodeType {
  switch (type) {
    case "observation":
      return "signal";
    case "inference":
      return "inference";
    case "effect":
      return "effect";
    case "action":
      return "action";
    case "outcome":
      return "outcome";
    default:
      return "state";
  }
}

function edgeRelation(type: string): CausalRelation {
  switch (type) {
    case "degrades":
    case "delays":
    case "suppresses":
      return "degrades";
    case "enables":
    case "observes":
    case "commands":
      return "enables";
    default:
      return "increases";
  }
}

export function causalSubgraphToGraph(
  subgraph: CausalSubgraph,
  coa?: CourseOfAction | null,
): CausalGraph {
  const nodes: CausalGraph["nodes"] = subgraph.nodes.map((node, index) => ({
    id: node.node_id || `path-${index}`,
    type: pathNodeType(node.type),
    label: formatCausalLabel(node.label),
    subtitle: node.type,
    confidence: node.confidence,
    time: `T+${node.tick}`,
    detail: coa ? `COA #${coa.id} · ${coa.action}` : undefined,
  }));

  const edges: CausalGraph["edges"] = [];
  for (let index = 0; index < nodes.length - 1; index++) {
    edges.push({
      id: `path-edge-${index}`,
      source: nodes[index].id,
      target: nodes[index + 1].id,
      relation: "enables" as const,
      weight: nodes[index + 1].confidence,
    });
  }

  for (const [index, claim] of subgraph.claims.entries()) {
    const causeId = `claim-cause-${index}`;
    const effectId = `claim-effect-${index}`;
    if (!nodes.some((node) => node.id === causeId)) {
      nodes.push({
        id: causeId,
        type: "signal",
        label: formatCausalLabel(claim.cause_variable),
        subtitle: "Cause",
        confidence: claim.confidence,
        detail: claim.label,
      });
    }
    if (!nodes.some((node) => node.id === effectId)) {
      nodes.push({
        id: effectId,
        type: "effect",
        label: formatCausalLabel(claim.effect_variable),
        subtitle: "Effect",
        confidence: claim.confidence,
        detail: `Status: ${claim.status}`,
      });
    }
    edges.push({
      id: `claim-edge-${index}`,
      source: causeId,
      target: effectId,
      relation: claim.effect_size >= 0 ? "increases" : "degrades",
      weight: Math.abs(claim.effect_size),
      evidence: [claim.label],
    });
  }

  for (const edge of subgraph.edges) {
    const sourceId = `event-${edge.source_event_id}`;
    const targetId = `event-${edge.target_event_id}`;
    if (!nodes.some((node) => node.id === sourceId)) {
      nodes.push({
        id: sourceId,
        type: "signal",
        label: edge.label || `Event ${edge.source_event_id}`,
        subtitle: "Evidence event",
        confidence: edge.confidence,
      });
    }
    if (!nodes.some((node) => node.id === targetId)) {
      nodes.push({
        id: targetId,
        type: "effect",
        label: edge.label || `Event ${edge.target_event_id}`,
        subtitle: "Downstream effect",
        confidence: edge.confidence,
      });
    }
    edges.push({
      id: `temporal-${edge.source_event_id}-${edge.target_event_id}`,
      source: sourceId,
      target: targetId,
      relation: edgeRelation(edge.type),
      weight: edge.strength,
      evidence: [edge.label],
    });
  }

  return { nodes, edges };
}
