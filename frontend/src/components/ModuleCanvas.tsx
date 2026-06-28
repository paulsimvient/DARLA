import {
  Controls,
  MarkerType,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { SimModule } from "../data/mockScenario";
import { layoutSimModules } from "../lib/elkLayout";
import ModuleNodeCard, { type ModuleNodeData } from "./modules/ModuleNodeCard";

const nodeTypes = { module: ModuleNodeCard };

const canvasDotGrid = {
  backgroundImage: "radial-gradient(circle at 1px 1px, rgba(63,63,70,0.35) 1px, transparent 0)",
  backgroundSize: "24px 24px",
};

type ModuleCanvasProps = {
  modules: SimModule[];
  selectedId: string | null;
  onSelectModule: (id: string | null) => void;
  onRemoveFromCanvas: (id: string) => void;
  onConnectionChange?: (sourceId: string, targetId: string, action: "add" | "remove") => void;
};

function buildEdges(canvasModules: SimModule[]): Edge[] {
  const onCanvasIds = new Set(canvasModules.map((m) => m.id));
  return canvasModules.flatMap((mod) =>
    mod.connections
      .filter((targetId) => onCanvasIds.has(targetId))
      .map((targetId) => ({
        id: `${mod.id}-${targetId}`,
        source: mod.id,
        target: targetId,
        type: "default",
        style: { stroke: "#3f3f46", strokeWidth: 1.5 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#3f3f46",
          width: 12,
          height: 12,
        },
      })),
  );
}

export default function ModuleCanvas({
  modules,
  selectedId,
  onSelectModule,
  onRemoveFromCanvas,
  onConnectionChange,
}: ModuleCanvasProps) {
  const canvasModules = useMemo(() => modules.filter((m) => m.onCanvas), [modules]);
  const canvasModuleIds = useMemo(
    () => canvasModules.map((m) => m.id).sort().join("|"),
    [canvasModules],
  );
  const layoutKeyRef = useRef<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ModuleNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    let cancelled = false;

    const syncNodes = (layout: Map<string, { x: number; y: number }>) => {
      setNodes((prev) => {
        const prevPositions = new Map(prev.map((node) => [node.id, node.position]));
        return canvasModules.map((mod) => ({
          id: mod.id,
          type: "module" as const,
          position: prevPositions.get(mod.id) ?? layout.get(mod.id) ?? { x: mod.x, y: mod.y },
          data: { module: mod, onRemove: onRemoveFromCanvas },
          selected: selectedId === mod.id,
          draggable: true,
        }));
      });
      setEdges(buildEdges(canvasModules));
    };

    if (layoutKeyRef.current !== canvasModuleIds) {
      layoutKeyRef.current = canvasModuleIds;
      void layoutSimModules(canvasModules).then((layout) => {
        if (!cancelled) syncNodes(layout);
      });
      return () => {
        cancelled = true;
      };
    }

    syncNodes(new Map());
    return () => {
      cancelled = true;
    };
  }, [canvasModules, canvasModuleIds, selectedId, onRemoveFromCanvas, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || !onConnectionChange) return;
      onConnectionChange(connection.source, connection.target, "add");
    },
    [onConnectionChange],
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      if (!onConnectionChange) return;
      for (const edge of deletedEdges) {
        onConnectionChange(edge.source, edge.target, "remove");
      }
    },
    [onConnectionChange],
  );

  const isValidConnection = useCallback(
    (connection: Edge | Connection) =>
      Boolean(connection.source && connection.target && connection.source !== connection.target),
    [],
  );

  return (
    <div className="darla-panel relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-darla-border px-3 py-2">
        <div>
          <h3 className="text-xs font-semibold text-darla-text">Module canvas</h3>
          <p className="text-[10px] text-darla-text-muted">
            {canvasModules.length} blocks · drag output → input to connect · select edge + Backspace to remove
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

      <div
        className="darla-scroll relative min-h-0 flex-1 overflow-hidden bg-[#0a0a0c]"
        style={canvasDotGrid}
      >
        {canvasModules.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-darla-text-muted">
            Add modules from the library to build your simulation graph
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            isValidConnection={isValidConnection}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            nodesDraggable
            nodesConnectable={Boolean(onConnectionChange)}
            elementsSelectable
            edgesFocusable
            panOnDrag={[1, 2]}
            zoomOnScroll
            minZoom={0.25}
            maxZoom={2}
            onNodeClick={(_, node) => onSelectModule(node.id)}
            onPaneClick={() => onSelectModule(null)}
            deleteKeyCode={["Backspace", "Delete"]}
            proOptions={{ hideAttribution: true }}
            colorMode="dark"
            className="!bg-transparent"
          >
            <Controls showInteractive={false} className="!border-darla-border !bg-darla-panel" />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
