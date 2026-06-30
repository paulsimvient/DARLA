import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import EvaluationReportPanel from "../components/evaluation/EvaluationReportPanel";
import { fetchRunEvaluation, runBlindPackEvaluation } from "../api";
import { useSimulation } from "../context/SimulationContext";
import type { EvaluationReport } from "../evaluation/types";

export default function EvaluationPage() {
  const { runIdentity, scenario, seed, runSimulation, status } = useSimulation();
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningPack, setRunningPack] = useState(false);

  const load = async () => {
    if (!runIdentity?.run_id) return;
    setLoading(true);
    try {
      const next = await fetchRunEvaluation(runIdentity.run_id);
      setReport(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load evaluation report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!runIdentity?.run_id) {
      setReport(null);
      setError(null);
      return;
    }
    let cancelled = false;
    const loadLoop = async () => {
      if (cancelled) return;
      try {
        const next = await fetchRunEvaluation(runIdentity.run_id);
        if (!cancelled) {
          setReport(next);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load evaluation report");
      }
    };
    void loadLoop();
    const id = window.setInterval(loadLoop, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [runIdentity?.run_id]);

  const runPack = async () => {
    if (!runIdentity?.run_id) return;
    setRunningPack(true);
    try {
      const next = await runBlindPackEvaluation({ runId: runIdentity.run_id, seeds: [seed] });
      setReport(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run blind pack evaluation");
    } finally {
      setRunningPack(false);
    }
  };

  return (
    <AppShell>
      <main className="min-h-0 flex-1 overflow-hidden bg-darla-bg p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-darla-border bg-darla-panel px-4 py-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-darla-text-muted">Evaluation</div>
            <div className="text-sm text-darla-text-secondary">Scenario: {scenario} · seed {seed}</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="darla-btn" type="button" onClick={runSimulation} disabled={status === "loading"}>
              {runIdentity ? "Restart run" : "Start run"}
            </button>
            <button className="darla-btn" type="button" onClick={load} disabled={!runIdentity || loading}>
              {loading ? "Refreshing…" : "Refresh eval"}
            </button>
            <button className="darla-btn darla-btn-primary" type="button" onClick={runPack} disabled={!runIdentity || runningPack}>
              {runningPack ? "Scoring…" : "Run blind pack score"}
            </button>
          </div>
        </div>
        {error ? <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
        {!runIdentity ? (
          <section className="rounded-2xl border border-darla-border bg-darla-panel p-6 text-sm text-darla-text-secondary">
            Start a run first. The evaluation harness scores the current run against hidden-truth challenge criteria and evidence-bundle completeness.
          </section>
        ) : report ? (
          <EvaluationReportPanel report={report} />
        ) : (
          <section className="rounded-2xl border border-darla-border bg-darla-panel p-6 text-sm text-darla-text-secondary">
            Loading evaluation report for run {runIdentity.run_id}…
          </section>
        )}
      </main>
    </AppShell>
  );
}
