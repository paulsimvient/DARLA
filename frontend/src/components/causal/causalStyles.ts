import type { CausalNodeType, CausalRelation } from "../../data/causalModel";

/** Bottom accent bar on module-style causal nodes */
export const nodeTypeAccent: Record<CausalNodeType, string> = {
  signal: "#71717a",
  inference: "#ef4444",
  state: "#f59e0b",
  action: "#22c55e",
  effect: "#f59e0b",
  outcome: "#3b82f6",
};

export const edgeRelationStyles: Record<CausalRelation, { stroke: string; dash?: string; width: number }> = {
  increases: { stroke: "#ef4444", width: 1.5 },
  decreases: { stroke: "#52525b", width: 1.5 },
  enables: { stroke: "#3b82f6", width: 1.5 },
  degrades: { stroke: "#f59e0b", width: 1.5 },
  mitigates: { stroke: "#22c55e", width: 1.5, dash: "6 4" },
};

export const layerLabels: Record<CausalNodeType, string> = {
  signal: "Observations",
  inference: "Inferences",
  state: "States",
  action: "Actions",
  effect: "Effects",
  outcome: "Outcomes",
};
