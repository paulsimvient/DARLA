import type { ExecutionGraphEdge, ExecutionGraphNode } from "../../data/mockCoSim";

const nodeColors: Record<ExecutionGraphNode["type"], string> = {
  fmu: "#4da3ff",
  native: "#5bd178",
  agent: "#c084fc",
  data_feed: "#67e8f9",
  bus: "#f5b84b",
  causal: "#ff9f43",
  coa: "#4da3ff",
  timeline: "#9fb2c8",
  python_script: "#f472b6",
};

type ExecutionGraphPanelProps = {
  nodes: ExecutionGraphNode[];
  edges: ExecutionGraphEdge[];
};

export default function ExecutionGraphPanel({ nodes, edges }: ExecutionGraphPanelProps) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const svgWidth = Math.max(980, nodes.length * 160 + 200);
  const svgHeight = 240;
  const nodeW = 130;
  const nodeH = 36;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-darla-border bg-darla-panel">
      <header className="border-b border-darla-border px-3 py-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-darla-text-secondary">
          Execution Graph
        </h3>
        <p className="mt-0.5 text-[10px] text-darla-text-secondary/80">
          Live wiring from scenario FMU bindings → DARLA event bus → causal → COA
        </p>
      </header>

      {nodes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-4 text-xs text-darla-text-secondary">
          No FMU execution graph — configure fmus: in scenario YAML.
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-3">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="min-w-full" style={{ minWidth: svgWidth }}>
            <defs>
              <marker id="exec-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8" fill="#24364f" />
              </marker>
            </defs>

            {edges.map((edge) => {
              const from = nodeMap.get(edge.from);
              const to = nodeMap.get(edge.to);
              if (!from || !to) return null;
              return (
                <g key={`${edge.from}-${edge.to}-${edge.label ?? ""}`}>
                  <line
                    x1={from.x + nodeW}
                    y1={from.y + nodeH / 2}
                    x2={to.x}
                    y2={to.y + nodeH / 2}
                    stroke="#24364f"
                    strokeWidth="1.5"
                    markerEnd="url(#exec-arrow)"
                  />
                  {edge.label ? (
                    <text
                      x={(from.x + nodeW + to.x) / 2}
                      y={(from.y + to.y) / 2 + nodeH / 2 - 6}
                      textAnchor="middle"
                      fill="#9fb2c8"
                      fontSize="9"
                    >
                      {edge.label}
                    </text>
                  ) : null}
                </g>
              );
            })}

            {nodes.map((node) => (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={nodeW}
                  height={nodeH}
                  rx={6}
                  fill="#0d1b2d"
                  stroke={nodeColors[node.type]}
                  strokeWidth="1.5"
                />
                <text
                  x={node.x + nodeW / 2}
                  y={node.y + nodeH / 2 + 4}
                  textAnchor="middle"
                  fill="#e7eefb"
                  fontSize="9"
                >
                  {node.label.length > 22 ? `${node.label.slice(0, 20)}…` : node.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}

      <div className="flex flex-wrap gap-3 border-t border-darla-border px-3 py-2">
        {Object.entries(nodeColors).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1.5 text-[9px] capitalize text-darla-text-secondary">
            <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
            {type.replace("_", " ")}
          </span>
        ))}
      </div>
    </div>
  );
}
