import { useMemo, useState } from "react";
import type { CausalNode, CausalNodeType } from "../data/mockScenario";
import { causalNodes } from "../data/mockScenario";
import CausalNodeDetails from "./CausalNodeDetails";

const nodeColors: Record<CausalNodeType, string> = {
  observation: "#4da3ff",
  inference: "#9fb2c8",
  action: "#5bd178",
  effect: "#f5b84b",
  risk: "#ff5d5d",
  outcome: "#c084fc",
  evidence: "#67e8f9",
};

type CausalGraphViewProps = {
  filterCoa?: string;
};

export default function CausalGraphView({ filterCoa }: CausalGraphViewProps) {
  const [selectedNode, setSelectedNode] = useState<CausalNode | null>(null);
  const [confidenceFilter, setConfidenceFilter] = useState(0);
  const [typeFilter, setTypeFilter] = useState<CausalNodeType | "all">("all");

  const filteredNodes = useMemo(() => {
    return causalNodes.filter((n) => {
      if (n.confidence < confidenceFilter / 100) return false;
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      return true;
    });
  }, [confidenceFilter, typeFilter]);

  const nodeMap = useMemo(
    () => new Map(filteredNodes.map((n) => [n.id, n])),
    [filteredNodes],
  );

  const edges = useMemo(() => {
    const result: { from: CausalNode; to: CausalNode }[] = [];
    for (const node of filteredNodes) {
      for (const downId of node.downstream) {
        const target = nodeMap.get(downId);
        if (target) result.push({ from: node, to: target });
      }
    }
    return result;
  }, [filteredNodes, nodeMap]);

  const svgWidth = 1280;
  const svgHeight = 220;

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-darla-border bg-darla-panel">
        <div className="flex flex-wrap items-center gap-3 border-b border-darla-border px-3 py-2">
          <FilterSelect
            label="Filter by COA"
            value={filterCoa ?? "all"}
            options={[
              { value: "all", label: "All COAs" },
              { value: "coa-1", label: "COA 1 — Seize Initiative" },
              { value: "coa-2", label: "COA 2 — Shape Operations" },
              { value: "coa-3", label: "COA 3 — Deny & Degrade" },
            ]}
            onChange={() => {}}
          />
          <FilterSelect
            label="Confidence"
            value={String(confidenceFilter)}
            options={[
              { value: "0", label: "All" },
              { value: "70", label: "≥ 70%" },
              { value: "80", label: "≥ 80%" },
            ]}
            onChange={(v) => setConfidenceFilter(Number(v))}
          />
          <FilterSelect
            label="Effect Type"
            value={typeFilter}
            options={[
              { value: "all", label: "All types" },
              ...Object.keys(nodeColors).map((t) => ({ value: t, label: t })),
            ]}
            onChange={(v) => setTypeFilter(v as CausalNodeType | "all")}
          />
        </div>

        <div className="flex-1 overflow-auto p-4">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="min-w-full"
            style={{ minWidth: svgWidth }}
          >
            {edges.map(({ from, to }) => (
              <line
                key={`${from.id}-${to.id}`}
                x1={from.x + 60}
                y1={from.y + 16}
                x2={to.x}
                y2={to.y + 16}
                stroke="#24364f"
                strokeWidth="2"
                markerEnd="url(#causal-arrow)"
              />
            ))}
            <defs>
              <marker id="causal-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8" fill="#24364f" />
              </marker>
            </defs>
            {filteredNodes.map((node) => (
              <g
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className="cursor-pointer"
              >
                <rect
                  x={node.x}
                  y={node.y}
                  width={120}
                  height={32}
                  rx={6}
                  fill={selectedNode?.id === node.id ? "#10243a" : "#0d1b2d"}
                  stroke={nodeColors[node.type]}
                  strokeWidth={selectedNode?.id === node.id ? 2 : 1}
                />
                <text
                  x={node.x + 60}
                  y={node.y + 20}
                  textAnchor="middle"
                  fill="#e7eefb"
                  fontSize="10"
                >
                  {node.label.length > 18 ? `${node.label.slice(0, 16)}…` : node.label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-darla-border px-3 py-2">
          {Object.entries(nodeColors).map(([type, color]) => (
            <span key={type} className="flex items-center gap-1.5 text-[10px] capitalize text-darla-text-secondary">
              <span className="h-2 w-2 rounded-full" style={{ background: color }} />
              {type}
            </span>
          ))}
        </div>
      </div>

      {selectedNode ? (
        <CausalNodeDetails node={selectedNode} onClose={() => setSelectedNode(null)} />
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[10px] text-darla-text-secondary">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-darla-border bg-darla-bg px-2 py-1 text-xs text-darla-text outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
