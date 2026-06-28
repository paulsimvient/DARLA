import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import RunHistoryTable from "../components/RunHistoryTable";
import { SCENARIOS, useSimulation } from "../context/SimulationContext";
import {
  buildSimulationRun,
  loadRunHistory,
  persistCompletedRun,
} from "../utils/runHistory";

export default function RunsPage() {
  const {
    scenario,
    seed,
    status,
    dashboard,
    currentTick,
    playback,
    activeCoa,
    runIdentity,
    branchResults,
    runSimulation,
  } = useSimulation();
  const scenarioMeta = SCENARIOS.find((s) => s.id === scenario) ?? SCENARIOS[0];
  const startedAtRef = useRef(new Date().toISOString());
  const [history, setHistory] = useState(loadRunHistory);

  useEffect(() => {
    startedAtRef.current = new Date().toISOString();
  }, [scenario, seed]);

  const currentRun = useMemo(
    () =>
      buildSimulationRun({
        scenarioLabel: scenarioMeta.label,
        scenarioPath: scenario,
        seed,
        status,
        dashboard,
        currentTick,
        tickSeconds: playback?.tick_seconds ?? 1,
        activeCoa,
        startedAt: startedAtRef.current,
        runId: runIdentity?.run_id,
        branchId: runIdentity?.branch_id,
        parentRunId: runIdentity?.parent_run_id,
      }),
    [
      scenarioMeta.label,
      scenario,
      seed,
      status,
      dashboard,
      currentTick,
      playback?.tick_seconds,
      activeCoa,
      runIdentity,
    ],
  );

  const persistRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "ready" || !dashboard?.replay_hash) return;
    if (persistRef.current === dashboard.replay_hash) return;
    persistRef.current = dashboard.replay_hash;
    setHistory(
      persistCompletedRun({
        ...buildSimulationRun({
          scenarioLabel: scenarioMeta.label,
          scenarioPath: scenario,
          seed,
          status: "ready",
          dashboard,
          currentTick,
          tickSeconds: playback?.tick_seconds ?? 1,
          activeCoa,
          startedAt: startedAtRef.current,
        }),
        status: "complete",
      }),
    );
  }, [status, dashboard, scenarioMeta.label, scenario, seed, currentTick, playback?.tick_seconds, activeCoa]);

  const runs = useMemo(() => {
    const withoutDup = history.filter((run) => run.id !== currentRun.id);
    if (currentRun.status === "running") {
      return [currentRun, ...withoutDup];
    }
    return withoutDup.length > 0 ? withoutDup : [currentRun];
  }, [history, currentRun]);

  return (
    <AppShell>
      <div className="darla-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-darla-bg p-5">
        <section className="rounded-xl border border-darla-border bg-darla-panel p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-darla-text-muted">
                Current run
              </h2>
              <p className="mt-1 text-xs text-darla-text-secondary">
                Live run · {runIdentity?.branch_id ?? "baseline"} · replay hash{" "}
                <span className="font-mono text-darla-text">
                  {(runIdentity?.replay_hash ?? dashboard?.replay_hash)?.slice(0, 16) ?? "pending"}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="darla-btn py-1.5 text-[11px]" onClick={runSimulation}>
                Re-run
              </button>
              <Link to="/overview" className="darla-btn py-1.5 text-[11px]">
                Open replay
              </Link>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4 lg:grid-cols-6">
            <Field label="Run ID" value={runIdentity?.run_id?.slice(0, 12) ?? currentRun.id} />
            <Field label="Branch" value={runIdentity?.branch_id ?? "baseline"} />
            <Field label="Scenario" value={currentRun.scenario} />
            <Field label="COA / policy" value={currentRun.coa} />
            <Field label="Status" value={currentRun.status} />
            <Field label="Duration" value={currentRun.duration} />
            <Field label="Success" value={`${currentRun.successProbability}%`} />
            <Field label="Seed" value={String(seed)} />
            <Field label="Tick" value={`T+${currentTick}`} />
            <Field label="What-if branches" value={String(branchResults.length)} />
            <Field label="Evidence" value={currentRun.evidence.slice(0, 18)} />
          </div>
        </section>

        {branchResults.length > 0 ? (
          <section className="rounded-xl border border-darla-border bg-darla-panel p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-darla-text-muted">
              Branch lineage
            </h2>
            <div className="mt-3 space-y-2">
              {branchResults.map((branch) => (
                <div
                  key={`${branch.branch_id}-${branch.branch_run_id ?? branch.replay_hash}`}
                  className="rounded-lg border border-violet-900/40 bg-violet-950/10 px-3 py-2 text-xs"
                >
                  <div className="font-medium text-darla-text">{branch.branch_id}</div>
                  <div className="mt-1 text-darla-text-muted">
                    Parent {branch.parent_run_id.slice(0, 12)} · branch run{" "}
                    {branch.branch_run_id?.slice(0, 12) ?? "pending"} · {branch.branch_status ?? "estimated"}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <RunHistoryTable runs={runs} />
      </div>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-darla-text-muted">{label}</div>
      <div className="mt-0.5 font-medium text-darla-text">{value}</div>
    </div>
  );
}
