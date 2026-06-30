import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchRunEvidence } from "../api";
import {
  buildAccurateCausalGraph,
  buildCausalAccuracySummary,
  confidenceStatus,
  type AccurateCausalGraphMode,
} from "../causal/accurateCausalGraph";
import AppShell from "../components/AppShell";
import AccurateCausalGraphPanel from "../components/causal/AccurateCausalGraphPanel";
import { useSimulation } from "../context/SimulationContext";
import { buildRuntimeCausalEvidence } from "../realism/causalEvidence";
import type { RunEvidenceSummary } from "../realism/types";

export default function CausalPage() {
  const {
    dashboard,
    events,
    timelineEvents,
    currentFrame,
    relationships,
    currentTick,
    coasAtCurrentTick,
    activeCoa,
    branchResults,
    runIdentity,
    status,
  } = useSimulation();
  const [graphMode, setGraphMode] = useState<AccurateCausalGraphMode>("causal");
  const [runEvidence, setRunEvidence] = useState<RunEvidenceSummary | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  useEffect(() => {
    if (!runIdentity?.run_id) {
      setRunEvidence(null);
      setEvidenceError(null);
      return;
    }

    let cancelled = false;
    let timeoutId: number | undefined;

    const load = async () => {
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
          timeoutId = window.setTimeout(load, 3000);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, [runIdentity?.run_id]);

  const localRuntimeEdges = useMemo(
    () =>
      buildRuntimeCausalEvidence(
        timelineEvents.length ? timelineEvents : events,
        currentFrame?.temporal_causal_edges ?? dashboard?.temporal_causal_graph ?? [],
        relationships,
      ),
    [currentFrame?.temporal_causal_edges, dashboard?.temporal_causal_graph, events, relationships, timelineEvents],
  );

  const runtimeEdges = runEvidence?.runtimeCausalEdges?.length
    ? runEvidence.runtimeCausalEdges
    : localRuntimeEdges;
  const claims = runEvidence?.causalClaims?.length ? runEvidence.causalClaims : dashboard?.claims ?? [];
  const coas = coasAtCurrentTick.length > 0 ? coasAtCurrentTick : activeCoa ? [activeCoa] : dashboard?.coa_log ?? [];
  const branchComparisons = runEvidence?.branchComparisons ?? [];
  const uncertaintyBands = runEvidence?.uncertaintyBands ?? [];
  const temporalEdges = currentFrame?.temporal_causal_edges ?? dashboard?.temporal_causal_graph ?? [];
  const sourceEvents = timelineEvents.length ? timelineEvents : events;

  const graphInput = useMemo(
    () => ({
      dashboard,
      events: sourceEvents,
      currentTick,
      relationships,
      runtimeEdges,
      claims,
      coas,
      branchResults,
      branchComparisons,
      uncertaintyBands,
      temporalEdges,
      mode: graphMode,
    }),
    [
      dashboard,
      sourceEvents,
      currentTick,
      relationships,
      runtimeEdges,
      claims,
      coas,
      branchResults,
      branchComparisons,
      uncertaintyBands,
      temporalEdges,
      graphMode,
    ],
  );

  const graph = useMemo(() => buildAccurateCausalGraph(graphInput), [graphInput]);
  const summary = useMemo(() => buildCausalAccuracySummary(graphInput), [graphInput]);
  const confidence = confidenceStatus(summary.confidence);
  const evidenceSource = runEvidence?.source === "run_api" ? "Run Evidence API" : "local runtime derivation";

  return (
    <AppShell>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-darla-bg p-4">
        <div className="mb-3 rounded-xl border border-darla-border bg-darla-panel p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-darla-text-muted">
                Evidence-backed causal reasoning
              </div>
              <h2 className="mt-1 text-sm font-semibold text-darla-text">
                {graphMode === "counterfactual" ? "Counterfactual Causal Graph" : "Runtime Causal Graph"}
              </h2>
              <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-darla-text-muted">
                This page is intentionally separate from the Module Graph. Module Graph nodes are simulation objects;
                this graph uses variables/events, causal edges, effect evidence, confidence, reportability, and COA branch support.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-md border border-darla-border bg-darla-bg px-2 py-1 text-darla-text-muted">
                Source: <span className="text-darla-text-secondary">{evidenceSource}</span>
              </span>
              <span className={`rounded-md border px-2 py-1 ${confidence.tone === "red" ? "border-red-800 bg-red-950/40 text-red-300" : confidence.tone === "orange" ? "border-orange-800 bg-orange-950/40 text-orange-300" : confidence.tone === "green" ? "border-emerald-800 bg-emerald-950/40 text-emerald-300" : "border-sky-800 bg-sky-950/40 text-sky-300"}`}>
                {confidence.badge}
              </span>
              <span className="rounded-md border border-darla-border bg-darla-bg px-2 py-1 text-darla-text-muted">
                T+{currentTick} · {status}
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex overflow-hidden rounded-lg border border-darla-border bg-darla-bg">
              {([
                ["causal", "Causal Graph"],
                ["counterfactual", "Counterfactual Graph"],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setGraphMode(mode)}
                  className={`border-r border-darla-border px-3 py-1.5 text-[11px] last:border-r-0 ${
                    graphMode === mode
                      ? "bg-darla-blue/20 text-darla-blue ring-1 ring-inset ring-darla-blue/40"
                      : "text-darla-text-muted hover:bg-darla-panel-elevated hover:text-darla-text-secondary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/modules" className="darla-btn py-1 text-[11px]">
                Open Module Graph
              </Link>
              <Link to="/realism" className="darla-btn py-1 text-[11px]">
                Open Realism Workbench
              </Link>
            </div>
          </div>

          {evidenceError ? (
            <div className="mt-2 rounded-lg border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-200">
              Run Evidence API unavailable: {evidenceError}. Falling back to local frame/event derivation.
            </div>
          ) : null}
        </div>

        <AccurateCausalGraphPanel
          graph={graph}
          summary={summary}
          currentTick={currentTick}
          modeLabel={graphMode === "counterfactual" ? "Counterfactual Graph" : "Evidence Causal Graph"}
        />
      </main>
    </AppShell>
  );
}
