import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  CausalDrilldownMode,
  CausalGraph,
  CausalNode,
  CausalNodeType,
  CausalSelectionContext,
} from "../../data/causalModel";
import Badge from "../Badge";
import { HGroup, RHandle, RPanel } from "../layout/ResizableLayout";
import { CausalWireframeIcon } from "./causalIcons";
import { layerLabels } from "./causalStyles";
import CausalFlowGraph from "./CausalFlowGraph";
import EvidenceTracePanel from "./EvidenceTracePanel";

const MODES: { id: CausalDrilldownMode; label: string }[] = [
  { id: "why", label: "Why?" },
  { id: "whatif", label: "What if?" },
  { id: "evidence", label: "Evidence" },
  { id: "decision", label: "Decision Trace" },
];

const FILTER_TYPES: { id: CausalNodeType; label: string }[] = [
  { id: "signal", label: "Signals" },
  { id: "inference", label: "Inferences" },
  { id: "state", label: "States" },
  { id: "action", label: "Actions" },
  { id: "effect", label: "Effects" },
  { id: "outcome", label: "Outcomes" },
];

type CausalWorkbenchProps = {
  context: CausalSelectionContext;
  graph: CausalGraph;
  header?: ReactNode;
  mapHint?: string;
  selectionBlurb?: string;
  mode?: CausalDrilldownMode;
  onModeChange?: (mode: CausalDrilldownMode) => void;
  showModeToolbar?: boolean;
  padded?: boolean;
};

export default function CausalWorkbench({
  context,
  graph,
  header,
  mapHint,
  selectionBlurb = "Map selection opened this causal panel — why the system believes risk is changing and which COAs affect the outcome.",
  mode: controlledMode,
  onModeChange,
  showModeToolbar = true,
  padded = true,
}: CausalWorkbenchProps) {
  const [internalMode, setInternalMode] = useState<CausalDrilldownMode>("why");
  const mode = controlledMode ?? internalMode;
  const setMode = onModeChange ?? setInternalMode;
  const [selectedNode, setSelectedNode] = useState<CausalNode | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<CausalNodeType>>(
    () => new Set(["signal", "inference", "state", "action", "effect", "outcome"]),
  );
  const [nodesOpen, setNodesOpen] = useState(true);

  useEffect(() => {
    if (graph.nodes[0]) setSelectedNode(graph.nodes[0]);
  }, [graph]);

  const filterSet = useMemo(() => {
    if (activeFilters.size === 6) return undefined;
    return activeFilters;
  }, [activeFilters]);

  const visibleNodes = useMemo(() => {
    if (!filterSet) return graph.nodes;
    return graph.nodes.filter((n) => filterSet.has(n.type));
  }, [graph.nodes, filterSet]);

  const toggleFilter = (type: CausalNodeType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const sidebar = (
    <aside className="darla-panel flex h-full w-full flex-col overflow-hidden">
          <div className="border-b border-darla-border p-3">
            <h3 className="text-xs font-semibold text-darla-text">Causal library</h3>
            <p className="mt-0.5 text-[11px] text-darla-text-muted">Browse nodes, filter layers, switch mode</p>
          </div>

          {showModeToolbar ? (
            <div className="border-b border-darla-border px-2 py-2">
              <span className="mb-1.5 block px-1 text-[10px] font-medium uppercase tracking-wider text-darla-text-muted">
                Mode
              </span>
              <div className="flex flex-wrap gap-1">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`rounded-md border px-2 py-1 text-[10px] transition-colors ${
                      mode === m.id
                        ? "border-darla-blue/40 bg-darla-blue-soft/30 text-darla-blue"
                        : "border-darla-border text-darla-text-muted hover:border-darla-border-subtle hover:text-darla-text-secondary"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="border-b border-darla-border p-3">
            <h4 className="truncate text-[11px] font-medium text-darla-text">{context.title}</h4>
            {context.subtitle ? (
              <p className="mt-0.5 truncate text-[10px] text-darla-text-muted">{context.subtitle}</p>
            ) : null}
            <p className="mt-2 text-[10px] leading-relaxed text-darla-text-muted">{selectionBlurb}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {context.tick != null ? <Badge tone="blue">T+{context.tick}</Badge> : null}
              {context.confidence != null ? (
                <Badge tone="neutral">{Math.round(context.confidence * 100)}%</Badge>
              ) : null}
              {context.coaCount != null && context.coaCount > 0 ? (
                <Badge tone="green">{context.coaCount} COAs</Badge>
              ) : null}
            </div>
          </div>

          <div className="border-b border-darla-border px-2 py-2">
            <span className="mb-1.5 block px-1 text-[10px] font-medium uppercase tracking-wider text-darla-text-muted">
              Layers
            </span>
            <div className="flex flex-wrap gap-1">
              {FILTER_TYPES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggleFilter(f.id)}
                  title={layerLabels[f.id]}
                  className={`flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] transition-colors ${
                    activeFilters.has(f.id)
                      ? "border-darla-blue/40 bg-darla-blue-soft/30 text-darla-blue"
                      : "border-darla-border text-darla-text-muted hover:border-darla-border-subtle hover:text-darla-text-secondary"
                  }`}
                >
                  <CausalWireframeIcon type={f.id} size={12} />
                  <span className="max-w-[72px] truncate">{f.label.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="darla-scroll min-h-0 flex-1 overflow-y-auto p-2">
            <section className="mb-2">
              <div className="flex items-center gap-1 rounded-md px-1 py-1 hover:bg-darla-panel-elevated/50">
                <button
                  type="button"
                  onClick={() => setNodesOpen((v) => !v)}
                  className="flex flex-1 items-center gap-1.5 text-left"
                >
                  {nodesOpen ? (
                    <ChevronDown size={12} className="text-darla-text-muted" />
                  ) : (
                    <ChevronRight size={12} className="text-darla-text-muted" />
                  )}
                  <span className="text-[11px] font-medium text-darla-text-secondary">Graph nodes</span>
                  <span className="ml-auto rounded bg-darla-panel-elevated px-1.5 text-[10px] tabular-nums text-darla-text-muted">
                    {visibleNodes.length}
                  </span>
                </button>
              </div>
              {nodesOpen ? (
                <div className="ml-1 space-y-0.5 border-l border-darla-border pl-2">
                  {visibleNodes.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setSelectedNode(node)}
                      className={`group flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors ${
                        selectedNode?.id === node.id
                          ? "bg-darla-blue-soft/30 ring-1 ring-inset ring-darla-blue/30"
                          : "hover:bg-darla-panel-elevated/60"
                      }`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-darla-border bg-darla-bg">
                        <CausalWireframeIcon type={node.type} size={14} className="text-darla-text-secondary" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[11px] font-medium text-darla-text">{node.label}</span>
                        <span className="block truncate text-[10px] text-darla-text-muted">
                          {node.subtitle ?? layerLabels[node.type]}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>

            <div className="mt-2 space-y-1 px-1 text-[10px] text-darla-text-muted">
              <LegendDot color="#ef4444" label="increases" />
              <LegendDot color="#f59e0b" label="degrades" />
              <LegendDot color="#22c55e" label="mitigates" dashed />
            </div>
          </div>
    </aside>
  );

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${padded ? "bg-darla-bg p-4" : ""}`}>
      {header}
      <HGroup id="darla-causal-h" autoSaveId="darla-causal-h" className="min-h-0 flex-1">
        <RPanel defaultSize={22} minSize={14} maxSize={36}>
          {sidebar}
        </RPanel>
        <RHandle />
        <RPanel defaultSize={50} minSize={30}>
          <CausalFlowGraph
            graph={graph}
            selectedNodeId={selectedNode?.id ?? null}
            onSelectNode={setSelectedNode}
            filterTypes={filterSet}
            mapHint={mapHint}
          />
        </RPanel>
        <RHandle />
        <RPanel defaultSize={28} minSize={18} maxSize={42}>
          <EvidenceTracePanel context={context} selectedNode={selectedNode} mode={mode} />
        </RPanel>
      </HGroup>
    </div>
  );
}

export { MODES };

function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block w-4"
        style={
          dashed
            ? { borderTop: `1.5px dashed ${color}`, height: 0, marginTop: 2 }
            : { background: color, height: 2, borderRadius: 9999 }
        }
      />
      {label}
    </span>
  );
}
