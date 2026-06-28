import ELK from "elkjs/lib/elk.bundled.js";
import type { CausalGraph } from "../data/causalModel";
import type { SimModule } from "../data/mockScenario";

const elk = new ELK();

const NODE_WIDTH = 112;
const NODE_HEIGHT = 72;

export async function layoutCausalGraph(graph: CausalGraph): Promise<Map<string, { x: number; y: number }>> {
  const elkGraph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.layered.spacing.nodeNodeBetweenLayers": "80",
      "elk.spacing.nodeNode": "36",
      "elk.edgeRouting": "ORTHOGONAL",
    },
    children: graph.nodes.map((node) => ({
      id: node.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const layout = await elk.layout(elkGraph);
  const positions = new Map<string, { x: number; y: number }>();

  for (const child of layout.children ?? []) {
    positions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  }

  return positions;
}

export async function layoutSimModules(
  modules: SimModule[],
): Promise<Map<string, { x: number; y: number }>> {
  const onCanvas = modules.filter((m) => m.onCanvas);
  const elkGraph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.layered.spacing.nodeNodeBetweenLayers": "96",
      "elk.spacing.nodeNode": "48",
      "elk.edgeRouting": "ORTHOGONAL",
    },
    children: onCanvas.map((mod) => ({
      id: mod.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })),
    edges: onCanvas.flatMap((mod) =>
      mod.connections.map((targetId) => ({
        id: `${mod.id}-${targetId}`,
        sources: [mod.id],
        targets: [targetId],
      })),
    ),
  };

  const layout = await elk.layout(elkGraph);
  const positions = new Map<string, { x: number; y: number }>();

  for (const child of layout.children ?? []) {
    positions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  }

  return positions;
}

export { NODE_WIDTH, NODE_HEIGHT };
