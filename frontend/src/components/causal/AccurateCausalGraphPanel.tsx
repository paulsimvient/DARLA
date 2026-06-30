import { useMemo, useState } from "react";
import type { CausalEdge, CausalGraph, CausalNode, CausalNodeType } from "../../data/causalModel";
import type { CausalAccuracySummary } from "../../causal/accurateCausalGraph";
import { confidenceStatus, formatPercent } from "../../causal/accurateCausalGraph";
import Badge from "../Badge";
import CausalAccuracySummaryCard from "./CausalAccuracySummaryCard";
import { layerLabels } from "./causalStyles";

type AccurateCausalGraphPanelProps = {
  graph: CausalGraph;
  summary: CausalAccuracySummary;
  currentTick: number;
  modeLabel?: string;
};

type Selection =
  | { kind: "node"; node: CausalNode }
  | { kind: "edge"; edge: CausalEdge; source?: PositionedNode; target?: PositionedNode }
  | null;

type PositionedNode = CausalNode & {
  x: number;
  y: number;
  lane: LaneKey;
  row: number;
};

type LaneKey = "signal" | "state" | "inference" | "effect" | "action" | "outcome";

const laneOrder: LaneKey[] = ["signal", "state", "inference", "effect", "action", "outcome"];

const laneMeta: Record<LaneKey, { label: string; x: number; tone: string; description: string; color: string }> = {
  signal: {
    label: "Observe",
    x: 44,
    tone: "border-sky-500/40 bg-sky-950/20",
    description: "runtime events and signals",
    color: "#60a5fa",
  },
  state: {
    label: "Belief / State",
    x: 260,
    tone: "border-amber-500/50 bg-amber-950/25",
    description: "estimated system condition",
    color: "#f59e0b",
  },
  inference: {
    label: "Infer",
    x: 476,
    tone: "border-pink-500/50 bg-pink-950/20",
    description: "causal hypothesis",
    color: "#ec4899",
  },
  effect: {
    label: "Effect",
    x: 692,
    tone: "border-orange-500/50 bg-orange-950/25",
    description: "operational consequence",
    color: "#f97316",
  },
  action: {
    label: "Intervene",
    x: 908,
    tone: "border-emerald-500/50 bg-emerald-950/25",
    description: "COA or mitigation",
    color: "#22c55e",
  },
  outcome: {
    label: "Outcome",
    x: 1124,
    tone: "border-blue-500/50 bg-blue-950/25",
    description: "mission result",
    color: "#3b82f6",
  },
};

const relationColor: Record<string, string> = {
  increases: "#ef4444",
  decreases: "#94a3b8",
  enables: "#60a5fa",
  degrades: "#f97316",
  mitigates: "#22c55e",
};

const NODE_W = 166;
const NODE_H = 70;
const ROW_H = 108;
const TOP_Y = 96;
const SVG_W = 1340;

function normalizeLane(type: CausalNodeType): LaneKey {
  if (type === "signal") return "signal";
  if (type === "state") return "state";
  if (type === "inference") return "inference";
  if (type === "effect") return "effect";
  if (type === "action") return "action";
  return "outcome";
}

function nodeScore(node: CausalNode, edges: CausalEdge[]): number {
  const outgoing = edges.filter((edge) => edge.source === node.id).length;
  const incoming = edges.filter((edge) => edge.target === node.id).length;
  return outgoing * 12 + incoming * 8 + (node.confidence ?? 0);
}

function layoutGraph(graph: CausalGraph): { nodes: PositionedNode[]; height: number } {
  const grouped = new Map<LaneKey, CausalNode[]>();
  for (const lane of laneOrder) grouped.set(lane, []);

  for (const node of graph.nodes) grouped.get(normalizeLane(node.type))!.push(node);

  const positioned: PositionedNode[] = [];
  let maxRows = 1;

  for (const lane of laneOrder) {
    const nodes = [...(grouped.get(lane) ?? [])].sort(
      (a, b) => nodeScore(b, graph.edges) - nodeScore(a, graph.edges) || a.label.localeCompare(b.label),
    );
    maxRows = Math.max(maxRows, nodes.length);

    nodes.forEach((node, index) => {
      positioned.push({
        ...node,
        lane,
        row: index,
        x: laneMeta[lane].x,
        y: TOP_Y + index * ROW_H,
      });
    });
  }

  return { nodes: positioned, height: Math.max(500, TOP_Y + maxRows * ROW_H + 110) };
}

function splitLabel(text: string, max = 20): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else current = next;
  }

  if (current) lines.push(current);
  return lines.slice(0, 2);
}

function relationStroke(edge: CausalEdge): string {
  return relationColor[edge.relation] ?? "#60a5fa";
}

function edgeStrength(edge: CausalEdge): "veryStrong" | "strong" | "moderate" | "weak" {
  const w = edge.weight ?? 0;
  if (w >= 0.8) return "veryStrong";
  if (w >= 0.6) return "strong";
  if (w >= 0.4) return "moderate";
  return "weak";
}

function edgeWidth(edge: CausalEdge): number {
  const w = edge.weight ?? 0.45;
  if (w >= 0.8) return 3.6;
  if (w >= 0.6) return 2.9;
  if (w >= 0.4) return 2.2;
  return 1.5;
}

function edgeOpacity(edge: CausalEdge): number {
  const w = edge.weight ?? 0.45;
  if (w >= 0.8) return 0.95;
  if (w >= 0.6) return 0.82;
  if (w >= 0.4) return 0.58;
  return 0.34;
}

function curve(source: PositionedNode, target: PositionedNode, edgeIndex: number): string {
  const sx = source.x + NODE_W;
  const sy = source.y + NODE_H / 2;
  const tx = target.x;
  const ty = target.y + NODE_H / 2;
  const dx = Math.max(86, Math.min(210, Math.abs(tx - sx) * 0.58));

  // Offset parallel-ish edges so they do not sit exactly on top of each other.
  const rowDelta = target.row - source.row;
  const verticalBend = Math.max(-34, Math.min(34, rowDelta * 18 + ((edgeIndex % 3) - 1) * 10));

  const c1x = sx + dx;
  const c1y = sy + verticalBend;
  const c2x = tx - dx;
  const c2y = ty - verticalBend;

  return `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`;
}

function labelPoint(source: PositionedNode, target: PositionedNode, edgeIndex: number) {
  const sx = source.x + NODE_W;
  const sy = source.y + NODE_H / 2;
  const tx = target.x;
  const ty = target.y + NODE_H / 2;
  const x = (sx + tx) / 2;
  const y = (sy + ty) / 2 - 20 + ((edgeIndex % 3) - 1) * 15;
  return { x, y };
}

function edgeKey(edge: CausalEdge): string {
  return `${edge.source}__${edge.target}__${edge.relation}`;
}

function edgeSortValue(edge: CausalEdge, nodes: Map<string, PositionedNode>): number {
  const source = nodes.get(edge.source);
  const target = nodes.get(edge.target);
  if (!source || !target) return 9999;
  return source.y + target.y + (edge.weight ?? 0);
}

function isCriticalEdge(edge: CausalEdge): boolean {
  return (edge.weight ?? 0) >= 0.6;
}

export default function AccurateCausalGraphPanel({
  graph,
  summary,
  currentTick,
  modeLabel = "Causal Graph",
}: AccurateCausalGraphPanelProps) {
  const [selection, setSelection] = useState<Selection>(null);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [showLabels, setShowLabels] = useState(true);

  const layout = useMemo(() => layoutGraph(graph), [graph]);
  const nodeById = useMemo(() => new Map(layout.nodes.map((node) => [node.id, node])), [layout.nodes]);

  const allVisibleEdges = useMemo(
    () =>
      [...graph.edges]
        .filter((edge) => nodeById.has(edge.source) && nodeById.has(edge.target))
        .sort((a, b) => edgeSortValue(a, nodeById) - edgeSortValue(b, nodeById)),
    [graph.edges, nodeById],
  );

  const visibleEdges = useMemo(
    () => (criticalOnly ? allVisibleEdges.filter(isCriticalEdge) : allVisibleEdges),
    [allVisibleEdges, criticalOnly],
  );

  const topEdges = useMemo(
    () => [...allVisibleEdges].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)).slice(0, 6),
    [allVisibleEdges],
  );

  const selectedNode = selection?.kind === "node" ? selection.node : null;
  const selectedEdge = selection?.kind === "edge" ? selection.edge : null;
  const selectedConfidence = selectedNode?.confidence ?? selectedEdge?.weight ?? summary.confidence;
  const selectedStatus = confidenceStatus(selectedConfidence);
  const graphStatus = confidenceStatus(summary.confidence);

  return (
    <div className="darla-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-darla-border p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold text-darla-text">{modeLabel}</h3>
            <p className="mt-1 max-w-4xl text-[10px] leading-relaxed text-darla-text-muted">
              Lane-based causal view with weighted Bézier paths. Thicker, brighter links indicate stronger causal support.
              Use critical paths to reduce clutter.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Badge tone={graphStatus.tone}>{formatPercent(summary.confidence)} graph confidence</Badge>
            <Badge tone="blue">{graph.nodes.length} nodes</Badge>
            <Badge tone="neutral">{visibleEdges.length}/{allVisibleEdges.length} edges</Badge>
            <Badge tone={summary.reportability === "reportable" ? "green" : summary.reportability === "insufficient" ? "red" : "orange"}>
              {summary.reportability}
            </Badge>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <CausalAccuracySummaryCard summary={summary} compact />
          <div className="flex gap-2 text-[10px]">
            <button
              type="button"
              onClick={() => setCriticalOnly((v) => !v)}
              className={`rounded-md border px-2 py-1 ${criticalOnly ? "border-darla-blue bg-darla-blue/20 text-darla-text" : "border-darla-border bg-darla-bg text-darla-text-muted"}`}
            >
              {criticalOnly ? "Critical paths only" : "Show all links"}
            </button>
            <button
              type="button"
              onClick={() => setShowLabels((v) => !v)}
              className={`rounded-md border px-2 py-1 ${showLabels ? "border-darla-blue bg-darla-blue/20 text-darla-text" : "border-darla-border bg-darla-bg text-darla-text-muted"}`}
            >
              {showLabels ? "Labels on" : "Labels off"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_330px] gap-0">
        <div className="darla-scroll min-h-0 overflow-auto bg-[#070b12]">
          <div className="min-w-[1340px] p-3">
            <div className="mb-3 grid grid-cols-6 gap-2">
              {laneOrder.map((lane) => (
                <div key={lane} className={`rounded-lg border px-3 py-2 ${laneMeta[lane].tone}`}>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: laneMeta[lane].color }} />
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-darla-text-secondary">
                      {laneMeta[lane].label}
                    </div>
                  </div>
                  <div className="mt-0.5 text-[10px] text-darla-text-muted">{laneMeta[lane].description}</div>
                </div>
              ))}
            </div>

            <svg
              viewBox={`0 0 ${SVG_W} ${layout.height}`}
              width={SVG_W}
              height={layout.height}
              className="rounded-xl border border-darla-border bg-[#09111f]"
              role="img"
              aria-label="Lane-based causal graph with weighted Bezier connections"
              onClick={() => setSelection(null)}
            >
              <defs>
                <pattern id="causalGrid2" width="24" height="24" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="1" fill="rgba(148,163,184,0.16)" />
                </pattern>

                <filter id="linkGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                <filter id="nodeGlow2" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodOpacity="0.35" />
                </filter>

                <marker id="causalArrow2" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="9" markerHeight="9" orient="auto">
                  <path d="M 0 0 L 12 6 L 0 12 z" fill="currentColor" />
                </marker>
              </defs>

              <rect x="0" y="0" width={SVG_W} height={layout.height} fill="url(#causalGrid2)" />

              {laneOrder.map((lane) => (
                <g key={`lane-${lane}`}>
                  <rect
                    x={laneMeta[lane].x - 18}
                    y="18"
                    width={NODE_W + 36}
                    height={layout.height - 36}
                    rx="18"
                    fill="rgba(15,23,42,0.25)"
                    stroke="rgba(148,163,184,0.10)"
                  />
                  <text
                    x={laneMeta[lane].x + NODE_W / 2}
                    y="45"
                    textAnchor="middle"
                    className="fill-slate-400 text-[10px] font-semibold uppercase tracking-[0.18em]"
                  >
                    {laneMeta[lane].label}
                  </text>
                </g>
              ))}

              <g>
                {visibleEdges.map((edge, index) => {
                  const source = nodeById.get(edge.source);
                  const target = nodeById.get(edge.target);
                  if (!source || !target) return null;

                  const stroke = relationStroke(edge);
                  const selected = selection?.kind === "edge" && edgeKey(selection.edge) === edgeKey(edge);
                  const strength = edgeStrength(edge);
                  const p = curve(source, target, index);
                  const lp = labelPoint(source, target, index);

                  return (
                    <g key={`${edge.id ?? edgeKey(edge)}-${index}`} opacity={selected ? 1 : edgeOpacity(edge)}>
                      {/* invisible hit target */}
                      <path
                        d={p}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="16"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelection({ kind: "edge", edge, source, target });
                        }}
                        style={{ cursor: "pointer" }}
                      />

                      {/* soft underlay makes link visible on dark grid */}
                      <path
                        d={p}
                        fill="none"
                        stroke="#020617"
                        strokeWidth={edgeWidth(edge) + 5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.72"
                      />

                      {/* glow layer */}
                      <path
                        d={p}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={edgeWidth(edge) + 2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={strength === "weak" ? 0.18 : 0.33}
                        filter={strength === "veryStrong" || selected ? "url(#linkGlow)" : undefined}
                      />

                      {/* primary edge */}
                      <path
                        d={p}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={selected ? edgeWidth(edge) + 1.4 : edgeWidth(edge)}
                        strokeDasharray={strength === "weak" ? "3 6" : strength === "moderate" ? "7 5" : undefined}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        markerEnd="url(#causalArrow2)"
                        style={{ color: stroke, cursor: "pointer" }}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelection({ kind: "edge", edge, source, target });
                        }}
                      />

                      {showLabels && (selected || (edge.weight ?? 0) >= 0.45) ? (
                        <g
                          transform={`translate(${lp.x}, ${lp.y})`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelection({ kind: "edge", edge, source, target });
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          <rect
                            x="-50"
                            y="-12"
                            width="100"
                            height="24"
                            rx="9"
                            fill="rgba(2,6,23,0.92)"
                            stroke={stroke}
                            strokeOpacity="0.55"
                          />
                          <text textAnchor="middle" y="4" className="fill-slate-100 text-[10px] font-semibold">
                            {edge.relation} · {formatPercent(edge.weight)}
                          </text>
                        </g>
                      ) : null}
                    </g>
                  );
                })}
              </g>

              <g>
                {layout.nodes.map((node) => {
                  const status = confidenceStatus(node.confidence);
                  const selected = selection?.kind === "node" && selection.node.id === node.id;
                  const labelLines = splitLabel(node.label);
                  const laneColor = laneMeta[node.lane].color;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelection({ kind: "node", node });
                      }}
                      style={{ cursor: "pointer" }}
                      filter={selected ? "url(#nodeGlow2)" : undefined}
                    >
                      <rect
                        x="-1"
                        y="-1"
                        width={NODE_W + 2}
                        height={NODE_H + 2}
                        rx="15"
                        fill={selected ? laneColor : "transparent"}
                        opacity={selected ? 0.32 : 0}
                      />
                      <rect
                        width={NODE_W}
                        height={NODE_H}
                        rx="14"
                        fill="rgba(15,23,42,0.97)"
                        stroke={selected ? "#e2e8f0" : laneColor}
                        strokeWidth={selected ? 2.4 : 1.5}
                      />
                      <rect x="0" y={NODE_H - 5} width={NODE_W} height="5" rx="2" fill={laneColor} opacity="0.85" />
                      {labelLines.map((line, lineIndex) => (
                        <text key={lineIndex} x="12" y={22 + lineIndex * 14} className="fill-slate-100 text-[12px] font-semibold">
                          {line}
                        </text>
                      ))}
                      <text x="12" y="57" className="fill-slate-400 text-[10px]">
                        {layerLabels[node.type]} · {formatPercent(node.confidence)}
                      </text>
                      <circle cx={NODE_W - 14} cy="14" r="4" fill={status.tone === "red" ? "#ef4444" : status.tone === "orange" ? "#f59e0b" : status.tone === "green" ? "#22c55e" : "#60a5fa"} />
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        </div>

        <aside className="darla-scroll border-l border-darla-border bg-darla-panel/80 p-3 text-xs">
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-darla-text-muted">
                {selection?.kind === "edge" ? "Selected link" : selection?.kind === "node" ? "Selected node" : "Graph inspector"}
              </div>
              <h4 className="mt-1 text-sm font-semibold text-darla-text">
                {selection?.kind === "node"
                  ? selection.node.label
                  : selection?.kind === "edge"
                    ? `${selection.source?.label ?? selection.edge.source} → ${selection.target?.label ?? selection.edge.target}`
                    : "No item selected"}
              </h4>
              <p className="mt-1 text-[11px] leading-relaxed text-darla-text-muted">
                {selection
                  ? selectedStatus.guidance
                  : "Click a node or a visible link. Links are weighted: bright/thick means stronger support; dashed means weaker evidence."}
              </p>
            </div>

            <div className="flex flex-wrap gap-1">
              <Badge tone={selectedStatus.tone}>{selectedStatus.badge}</Badge>
              <Badge tone={selectedStatus.reportable ? "green" : "orange"}>
                {selectedStatus.reportable ? "reportable within envelope" : "review required"}
              </Badge>
              <Badge tone="neutral">T+{currentTick}</Badge>
            </div>

            {selection?.kind === "node" ? (
              <NodeInspector node={selection.node} />
            ) : selection?.kind === "edge" ? (
              <EdgeInspector edge={selection.edge} source={selection.source} target={selection.target} />
            ) : (
              <div className="rounded-lg border border-darla-border bg-darla-bg p-3 text-[11px] leading-relaxed text-darla-text-muted">
                <div className="mb-2 font-semibold text-darla-text-secondary">How to read this graph</div>
                <ul className="list-disc space-y-1 pl-4">
                  <li>Columns are causal stages, not arbitrary layout.</li>
                  <li>Color identifies stage/relation type.</li>
                  <li>Line thickness indicates support strength.</li>
                  <li>Dashed lines are weaker/moderate evidence.</li>
                  <li>Use “Critical paths only” to reduce clutter.</li>
                </ul>
              </div>
            )}

            <div className="border-t border-darla-border pt-3">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-darla-text-muted">
                Critical paths
              </div>
              <div className="space-y-2">
                {topEdges.length > 0 ? (
                  topEdges.map((edge) => {
                    const source = nodeById.get(edge.source);
                    const target = nodeById.get(edge.target);
                    const edgeStatus = confidenceStatus(edge.weight ?? 0);
                    return (
                      <button
                        key={edge.id ?? edgeKey(edge)}
                        type="button"
                        onClick={() => setSelection({ kind: "edge", edge, source, target })}
                        className="w-full rounded-lg border border-darla-border bg-darla-bg p-2 text-left text-[11px] hover:border-darla-blue/60"
                      >
                        <div className="font-medium leading-snug text-darla-text-secondary">
                          {source?.label ?? edge.source} → {target?.label ?? edge.target}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge tone={edgeStatus.tone}>{edge.relation} · {formatPercent(edge.weight)}</Badge>
                          <Badge tone="neutral">{edge.evidence?.length ?? 0} evidence</Badge>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-darla-border bg-darla-bg p-2 text-[11px] text-darla-text-muted">
                    No causal edges emitted yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-darla-border bg-darla-bg p-3 text-[11px] text-darla-text-muted">
              <div className="mb-2 font-semibold text-darla-text-secondary">Link strength legend</div>
              <LegendRow label="Very strong" style="solid thick" range="0.80–1.00" />
              <LegendRow label="Strong" style="solid" range="0.60–0.79" />
              <LegendRow label="Moderate" style="dashed" range="0.40–0.59" />
              <LegendRow label="Weak" style="faint dashed" range="0.00–0.39" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function LegendRow({ label, style, range }: { label: string; style: string; range: string }) {
  return (
    <div className="mt-1 grid grid-cols-[70px_1fr] gap-2">
      <span className="text-darla-text-secondary">{range}</span>
      <span>{label} · {style}</span>
    </div>
  );
}

function NodeInspector({ node }: { node: CausalNode }) {
  const status = confidenceStatus(node.confidence);
  const evidenceBlocks = node.detail?.split("\n\n").filter(Boolean) ?? [];

  return (
    <>
      <div className="rounded-lg border border-darla-border bg-darla-bg p-3 text-[11px] leading-relaxed text-darla-text-secondary">
        <div className="mb-1 font-semibold text-darla-text">Node role</div>
        <div>{layerLabels[node.type]} · {node.subtitle ?? "runtime variable/event"}</div>
        {node.time ? <div className="mt-1 text-darla-text-muted">{node.time}</div> : null}
      </div>

      <div className="rounded-lg border border-darla-border bg-darla-bg p-3 text-[11px] leading-relaxed text-darla-text-secondary">
        <div className="mb-1 font-semibold text-darla-text">Evidence</div>
        {evidenceBlocks.length ? (
          evidenceBlocks.map((block, index) => (
            <p key={index} className={index > 0 ? "mt-2" : ""}>{block}</p>
          ))
        ) : (
          <p>No node-specific evidence block was emitted.</p>
        )}
      </div>

      <div className="rounded-lg border border-darla-border bg-darla-bg p-3 text-[11px] leading-relaxed text-darla-text-muted">
        <span className="font-semibold text-darla-text-secondary">Reportability:</span> {status.guidance}
      </div>
    </>
  );
}

function EdgeInspector({
  edge,
  source,
  target,
}: {
  edge: CausalEdge;
  source?: CausalNode;
  target?: CausalNode;
}) {
  const status = confidenceStatus(edge.weight ?? 0);

  return (
    <>
      <div className="rounded-lg border border-darla-border bg-darla-bg p-3 text-[11px] leading-relaxed text-darla-text-secondary">
        <div className="mb-1 font-semibold text-darla-text">Claim</div>
        <div>
          <span className="text-darla-text">{source?.label ?? edge.source}</span>{" "}
          <span className="text-darla-text-muted">{edge.relation}</span>{" "}
          <span className="text-darla-text">{target?.label ?? edge.target}</span>
        </div>
        <div className="mt-1 text-darla-text-muted">Evidence score {formatPercent(edge.weight)}</div>
      </div>

      <div className="rounded-lg border border-darla-border bg-darla-bg p-3 text-[11px] leading-relaxed text-darla-text-secondary">
        <div className="mb-1 font-semibold text-darla-text">Supporting evidence</div>
        {edge.evidence?.length ? (
          <ul className="list-disc space-y-1 pl-4">
            {edge.evidence.slice(0, 8).map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        ) : (
          <p>No edge-level evidence items were emitted.</p>
        )}
      </div>

      <div className="rounded-lg border border-darla-border bg-darla-bg p-3 text-[11px] leading-relaxed text-darla-text-muted">
        <span className="font-semibold text-darla-text-secondary">Reportability:</span> {status.guidance}
      </div>
    </>
  );
}
