import { useMemo } from "react";
import BezierCausalMap from "./BezierCausalMap";
import { toBezierCausalMap } from "./toBezierCausalMap";

type Props = {
  dashboardData: Record<string, any>;
};

export default function CausalMapPanel({ dashboardData }: Props) {
  const map = useMemo(() => toBezierCausalMap(dashboardData ?? {}), [dashboardData]);

  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ margin: "0 0 4px" }}>Causal Map</h2>
          <p style={{ margin: "0 0 12px", opacity: 0.72 }}>
            Curved causal paths show observation → belief → causal effect → decision support.
          </p>
        </div>
        <small style={{ opacity: 0.66 }}>
          {map.nodes.length} nodes · {map.edges.length} edges
        </small>
      </div>

      <BezierCausalMap nodes={map.nodes} edges={map.edges} />
    </section>
  );
}
