import { useMemo } from "react";
import AppShell from "../components/AppShell";
import CausalWorkbench from "../components/causal/CausalWorkbench";
import {
  buildCausalGraphFromDashboard,
  contextFromDashboard,
  DEMO_CAUSAL_GRAPH,
} from "../data/causalModel";
import { useSimulation } from "../context/SimulationContext";

export default function CausalPage() {
  const { dashboard, events, currentTick } = useSimulation();

  const context = useMemo(() => {
    if (dashboard) return contextFromDashboard(dashboard, currentTick);
    return {
      kind: "alert" as const,
      id: "demo",
      title: "Port-A UAS + Cyber Disruption",
      subtitle: "Demo causal graph — run simulation for live export",
      confidence: 0.74,
      coaCount: 2,
    };
  }, [dashboard, currentTick]);

  const graph = useMemo(() => {
    if (dashboard) return buildCausalGraphFromDashboard(dashboard, events, currentTick);
    return DEMO_CAUSAL_GRAPH;
  }, [dashboard, events, currentTick]);

  const selectionBlurb = dashboard
    ? "Full temporal causal export from sim-export — event→event edges active at the current tick."
    : "Demo graph from the causal drill-down spec. Run a simulation to populate live temporal edges.";

  const mapHint = dashboard
    ? "Select nodes in the library or canvas. Open map drill-down from individual units or events."
    : undefined;

  return (
    <AppShell>
      {!dashboard ? (
        <div className="shrink-0 border-b border-amber-900/40 bg-amber-950/20 px-5 py-2 text-[12px] text-amber-200/90">
          Loading sim-export… showing demo causal graph until dashboard data arrives.
        </div>
      ) : null}
      <CausalWorkbench context={context} graph={graph} selectionBlurb={selectionBlurb} mapHint={mapHint} />
    </AppShell>
  );
}
