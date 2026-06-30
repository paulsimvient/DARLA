import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import RealismWorkbench from "../components/realism/RealismWorkbench";
import { fetchRunEvidence } from "../api";
import { useSimulation } from "../context/SimulationContext";
import type { RunEvidenceSummary } from "../realism/types";

export default function RealismPage() {
  const {
    scenario,
    dashboard,
    runIdentity,
    currentTick,
    currentFrame,
    events,
    timelineEvents,
    relationships,
    coasAtCurrentTick,
    activeCoa,
    branchResults,
  } = useSimulation();

  const [runEvidence, setRunEvidence] = useState<RunEvidenceSummary | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  useEffect(() => {
    if (!runIdentity?.run_id) {
      setRunEvidence(null);
      setEvidenceLoading(false);
      setEvidenceError(null);
      return;
    }

    let cancelled = false;
    let timeoutId: number | undefined;

    const loadEvidence = async () => {
      setEvidenceLoading(true);
      try {
        const evidence = await fetchRunEvidence(runIdentity.run_id);
        if (!cancelled) {
          setRunEvidence(evidence);
          setEvidenceError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setEvidenceError(error instanceof Error ? error.message : "Failed to load run evidence");
        }
      } finally {
        if (!cancelled) {
          setEvidenceLoading(false);
          timeoutId = window.setTimeout(loadEvidence, 2500);
        }
      }
    };

    void loadEvidence();

    return () => {
      cancelled = true;
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [runIdentity?.run_id]);

  const coas = coasAtCurrentTick.length > 0 ? coasAtCurrentTick : activeCoa ? [activeCoa] : dashboard?.coa_log ?? [];

  return (
    <AppShell>
      <main className="min-h-0 flex-1 overflow-hidden bg-darla-bg p-4">
        <RealismWorkbench
          scenario={scenario}
          dashboard={dashboard}
          runIdentity={runIdentity}
          currentTick={currentTick}
          currentFrame={currentFrame}
          events={events}
          timelineEvents={timelineEvents}
          relationships={relationships}
          temporalEdges={currentFrame?.temporal_causal_edges ?? dashboard?.temporal_causal_graph ?? []}
          coas={coas}
          branchResults={branchResults}
          runEvidence={runEvidence}
          evidenceLoading={evidenceLoading}
          evidenceError={evidenceError}
        />
      </main>
    </AppShell>
  );
}
