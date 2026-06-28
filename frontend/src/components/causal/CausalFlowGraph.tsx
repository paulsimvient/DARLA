import {
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CausalGraph, CausalNode } from "../../data/causalModel";
import { layoutCausalGraph } from "../../lib/elkLayout";
import CausalNodeCard, { type CausalNodeData } from "./CausalNodeCard";
import { edgeRelationStyles } from "./causalStyles";

const nodeTypes = { causal: CausalNodeCard };

const canvasDotGrid = {
  backgroundImage: "radial-gradient(circle at 1px 1px, rgba(63,63,70,0.35) 1px, transparent 0)",
  backgroundSize: "24px 24px",
};

type CausalFlowGraphProps = {
  graph: CausalGraph;
  selectedNodeId: string | null;
  onSelectNode: (node: CausalNode | null) => void;
  filterTypes?: Set<string>;
  mapHint?: string;
};

export default function CausalFlowGraph({
  graph,
  selectedNodeId,
  onSelectNode,
  filterTypes,
  mapHint,
}: CausalFlowGraphProps) {
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    let cancelled = false;
    void layoutCausalGraph(graph).then((layout) => {
      if (!cancelled) setPositions(layout);
    });
    return () => {
      cancelled = true;
    };
  }, [graph]);

  const visibleNodes = useMemo(() => {
    if (!filterTypes || filterTypes.size === 0) return graph.nodes;
    return graph.nodes.filter((n) => filterTypes.has(n.type));
  }, [graph.nodes, filterTypes]);

  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const flowNodes: Node<CausalNodeData>[] = useMemo(
    () =>
      visibleNodes.map((node) => {
        const pos = positions.get(node.id) ?? { x: 0, y: 0 };
        return {
          id: node.id,
          type: "causal",
          position: pos,
          data: { causal: node, selected: selectedNodeId === node.id },
          selected: selectedNodeId === node.id,
        };
      }),
    [visibleNodes, positions, selectedNodeId],
  );

  const flowEdges: Edge[] = useMemo(
    () =>
      graph.edges
        .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
        .map((edge) => {
          const style = edgeRelationStyles[edge.relation];
          return {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: "smoothstep",
            animated: edge.relation === "mitigates",
            style: {
              stroke: style.stroke,
              strokeWidth: style.width,
              strokeDasharray: style.dash,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: style.stroke,
              width: 12,
              height: 12,
            },
          };
        }),
    [graph.edges, visibleIds],
  );

  return (
    <div className="darla-panel relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-darla-border px-3 py-2">
        <div>
          <h3 className="text-xs font-semibold text-darla-text">Causal canvas</h3>
          <p className="text-[10px] text-darla-text-muted">
            {visibleNodes.length} nodes · {flowEdges.length} edges
          </p>
        </div>
        <div className="flex gap-1">
          <button type="button" className="darla-btn !p-1.5" title="Zoom in">
            <ZoomIn size={14} strokeWidth={1.25} />
          </button>
          <button type="button" className="darla-btn !p-1.5" title="Zoom out">
            <ZoomOut size={14} strokeWidth={1.25} />
          </button>
        </div>
      </header>

      <div className="darla-scroll relative min-h-0 flex-1 overflow-hidden bg-[#0a0a0c]" style={canvasDotGrid}>
        {mapHint ? (
          <div className="absolute right-4 top-4 z-10 max-w-[200px] rounded-lg border border-darla-border bg-darla-panel/95 p-2.5 text-[11px] leading-relaxed text-darla-text-secondary backdrop-blur-sm">
            {mapHint}
          </div>
        ) : null}
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          onNodeClick={(_, node) => onSelectNode(node.data.causal)}
          onPaneClick={() => onSelectNode(null)}
          proOptions={{ hideAttribution: true }}
          colorMode="dark"
          className="!bg-transparent"
        >
          <Controls showInteractive={false} className="!border-darla-border !bg-darla-panel" />
        </ReactFlow>
      </div>
    </div>
  );
}
