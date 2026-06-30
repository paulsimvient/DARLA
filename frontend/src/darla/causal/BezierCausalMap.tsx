import "./bezierCausalMap.css";

export type CausalMapNode = {
  id: string;
  label: string;
  type?: "observation" | "belief" | "cause" | "effect" | "decision" | "action" | "asset" | "threat";
  x: number;
  y: number;
};

export type CausalMapEdge = {
  id?: string;
  source: string;
  target: string;
  label?: string;
  confidence?: number;
  relation?: string;
  strength?: number;
};

type Props = {
  nodes: CausalMapNode[];
  edges: CausalMapEdge[];
  width?: number;
  height?: number;
};

function nodeClass(type?: CausalMapNode["type"]): string {
  return `bezier-node ${type ? `bezier-node-${type}` : ""}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function cubicPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  strength = 0.45
): string {
  const dx = tx - sx;
  const dy = ty - sy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const bend = clamp(distance * strength, 50, 220);

  // Horizontal-first curve. Works well for left-to-right causal graphs.
  const c1x = sx + bend;
  const c1y = sy;
  const c2x = tx - bend;
  const c2y = ty;

  return `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`;
}

function cubicPoint(
  sx: number,
  sy: number,
  c1x: number,
  c1y: number,
  c2x: number,
  c2y: number,
  tx: number,
  ty: number,
  t: number
): { x: number; y: number } {
  const mt = 1 - t;
  return {
    x:
      mt * mt * mt * sx +
      3 * mt * mt * t * c1x +
      3 * mt * t * t * c2x +
      t * t * t * tx,
    y:
      mt * mt * mt * sy +
      3 * mt * mt * t * c1y +
      3 * mt * t * t * c2y +
      t * t * t * ty,
  };
}

function labelPoint(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  strength = 0.45
): { x: number; y: number } {
  const dx = tx - sx;
  const dy = ty - sy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const bend = clamp(distance * strength, 50, 220);
  return cubicPoint(sx, sy, sx + bend, sy, tx - bend, ty, tx, ty, 0.5);
}

export default function BezierCausalMap({
  nodes,
  edges,
  width = 1100,
  height = 620,
}: Props) {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="bezier-causal-map">
      <svg
        className="bezier-causal-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Causal map with curved directed relationships"
      >
        <defs>
          <marker
            id="bezier-arrow"
            viewBox="0 0 12 12"
            refX="10"
            refY="6"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 12 6 L 0 12 z" />
          </marker>

          <filter id="nodeGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodOpacity="0.35" />
          </filter>
        </defs>

        <g className="bezier-edges">
          {edges.map((edge, index) => {
            const source = byId.get(edge.source);
            const target = byId.get(edge.target);
            if (!source || !target) return null;

            const sx = source.x + 86;
            const sy = source.y + 22;
            const tx = target.x - 8;
            const ty = target.y + 22;
            const path = cubicPath(sx, sy, tx, ty, edge.strength ?? 0.45);
            const label = edge.label ?? edge.relation;
            const lp = labelPoint(sx, sy, tx, ty, edge.strength ?? 0.45);

            return (
              <g key={edge.id ?? `${edge.source}-${edge.target}-${index}`}>
                <path
                  className="bezier-edge-path"
                  d={path}
                  markerEnd="url(#bezier-arrow)"
                />
                {label && (
                  <g transform={`translate(${lp.x}, ${lp.y - 10})`}>
                    <rect
                      className="bezier-edge-label-bg"
                      x={-58}
                      y={-12}
                      width={116}
                      height={24}
                      rx={8}
                    />
                    <text className="bezier-edge-label" textAnchor="middle" dy="4">
                      {label}
                      {typeof edge.confidence === "number"
                        ? ` ${Math.round(edge.confidence * 100)}%`
                        : ""}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>

        <g className="bezier-nodes">
          {nodes.map((node) => (
            <g
              key={node.id}
              className={nodeClass(node.type)}
              transform={`translate(${node.x}, ${node.y})`}
              filter="url(#nodeGlow)"
            >
              <rect width="172" height="48" rx="12" />
              <text x="14" y="21" className="bezier-node-label">
                {node.label.length > 23 ? `${node.label.slice(0, 22)}…` : node.label}
              </text>
              <text x="14" y="36" className="bezier-node-type">
                {node.type ?? "causal"}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
