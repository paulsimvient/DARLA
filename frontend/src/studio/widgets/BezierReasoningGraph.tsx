import { getCandidateActions, getCausalEdges } from "../dataSelectors";

type Props = { data: Record<string, any> };

type Node = {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
};

function path(sx: number, sy: number, tx: number, ty: number) {
  const dx = Math.max(80, Math.min(220, Math.abs(tx - sx) * 0.45));
  return `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
}

export default function BezierReasoningGraph({ data }: Props) {
  const edges = getCausalEdges(data);
  const actions = getCandidateActions(data);

  const nodes: Node[] = [
    { id: "observation", label: "Observation", type: "input", x: 40, y: 120 },
    { id: "belief", label: "Belief Update", type: "belief", x: 250, y: 120 },
    { id: "causal", label: "Causal Effect", type: "causal", x: 480, y: 120 },
    { id: "counterfactual", label: "Counterfactual", type: "sim", x: 710, y: 120 },
    { id: "decision", label: actions[0]?.label ?? actions[0]?.id ?? "Decision", type: "decision", x: 950, y: 120 },
  ];

  const graphEdges = [
    ["observation", "belief", "updates"],
    ["belief", "causal", edges[0]?.relation ?? "supports"],
    ["causal", "counterfactual", "tests"],
    ["counterfactual", "decision", "ranks"],
  ];

  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <section className="reasoning-graph">
      <svg viewBox="0 0 1160 330">
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" />
          </marker>
        </defs>

        {graphEdges.map(([sourceId, targetId, label]) => {
          const source = byId.get(sourceId)!;
          const target = byId.get(targetId)!;
          const sx = source.x + 150;
          const sy = source.y + 32;
          const tx = target.x;
          const ty = target.y + 32;
          return (
            <g key={`${sourceId}-${targetId}`}>
              <path className="reasoning-edge" d={path(sx, sy, tx, ty)} markerEnd="url(#arrowhead)" />
              <text className="reasoning-edge-label" x={(sx + tx) / 2} y={(sy + ty) / 2 - 18} textAnchor="middle">
                {label}
              </text>
            </g>
          );
        })}

        {nodes.map((node) => (
          <g key={node.id} className={`reasoning-node ${node.type}`} transform={`translate(${node.x}, ${node.y})`}>
            <rect width="150" height="64" rx="14" />
            <text x="14" y="29">{node.label}</text>
            <text x="14" y="47" className="node-sub">{node.type}</text>
          </g>
        ))}
      </svg>
    </section>
  );
}
