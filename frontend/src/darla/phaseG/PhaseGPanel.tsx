import { useMemo, useState } from "react";
import LayerCards from "./LayerCards";
import DecisionTrace from "./DecisionTrace";
import { normalizePhaseGExport } from "./normalizePhaseG";
import "./phaseG.css";

type Props = {
  dashboardData: Record<string, any>;
};

export default function PhaseGPanel({ dashboardData }: Props) {
  const [traceOpen, setTraceOpen] = useState(false);

  const phaseG = useMemo(
    () => normalizePhaseGExport(dashboardData ?? {}),
    [dashboardData]
  );

  return (
    <section aria-label="DARLA Phase G formal reasoning architecture">
      <LayerCards data={phaseG} onOpenTrace={() => setTraceOpen((v) => !v)} />
      {traceOpen && <DecisionTrace data={phaseG} />}
    </section>
  );
}
