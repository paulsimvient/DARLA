import Badge from "../Badge";
import type { BranchResult, MissionMetrics, RunIdentity } from "../../types";
import { formatCoaAction } from "../../utils/coaHelpers";
import type { ReplayView } from "../../context/SimulationContext";

type BranchComparisonPanelProps = {
  runIdentity: RunIdentity | null;
  baselineMetrics: MissionMetrics | null;
  branchResults: BranchResult[];
  selectedCoaId?: number | null;
  replayView: ReplayView;
  compareBranch: BranchResult | null;
  activeBranch: BranchResult | null;
  onOpenBranchReplay: (branch: BranchResult) => void;
  onStartCompare: (branch: BranchResult) => void;
  onReturnToBaseline: () => void;
  onStopCompare: () => void;
};

function deltaTone(value: number): "good" | "bad" | "neutral" {
  if (value > 0.05) return "good";
  if (value < -0.05) return "bad";
  return "neutral";
}

function deltaClass(tone: "good" | "bad" | "neutral"): string {
  switch (tone) {
    case "good":
      return "text-emerald-400";
    case "bad":
      return "text-red-400";
    default:
      return "text-darla-text-secondary";
  }
}

function branchStatusTone(status?: string): "green" | "blue" | "neutral" {
  if (status === "completed") return "green";
  if (status === "live" || status === "starting") return "blue";
  return "neutral";
}

export default function BranchComparisonPanel({
  runIdentity,
  baselineMetrics,
  branchResults,
  selectedCoaId,
  replayView,
  compareBranch,
  activeBranch,
  onOpenBranchReplay,
  onStartCompare,
  onReturnToBaseline,
  onStopCompare,
}: BranchComparisonPanelProps) {
  const filtered = selectedCoaId
    ? branchResults.filter((branch) => branch.coa_id === selectedCoaId)
    : branchResults;

  if (!runIdentity && filtered.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-darla-border bg-darla-panel/90 p-3 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[13px] font-bold text-darla-text">Branch comparison</div>
          <div className="text-[11px] text-darla-text-muted">
            Baseline branch vs counterfactual estimate and live branch run
          </div>
        </div>
        {filtered.length > 0 ? (
          <Badge tone="blue">{filtered.length} what-if</Badge>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-sky-300">
            Current branch
          </div>
          <div className="mt-1 text-[13px] font-bold text-darla-text">
            {runIdentity?.branch_id ?? "baseline"}
          </div>
          <dl className="mt-3 space-y-1.5 text-[11px]">
            <Row label="Run ID" value={runIdentity?.run_id?.slice(0, 12) ?? "—"} />
            <Row
              label="Mission score"
              value={baselineMetrics ? baselineMetrics.mission_success_score.toFixed(3) : "—"}
            />
            <Row
              label="Detection"
              value={
                baselineMetrics?.target_detected
                  ? `T+${baselineMetrics.detection_time}`
                  : "Not detected"
              }
            />
            <Row label="Replay hash" value={runIdentity?.replay_hash?.slice(0, 12) ?? "—"} mono />
          </dl>
        </article>

        {filtered.map((branch) => {
          const missionTone = deltaTone(branch.mission_delta);
          const detectionTone = deltaTone(-branch.detection_time_delta);
          const branchMetrics = branch.branch_metrics;
          const isActiveBranch =
            replayView === "branch" && activeBranch?.branch_id === branch.branch_id;
          const isCompareTarget =
            replayView === "compare" && compareBranch?.branch_id === branch.branch_id;
          return (
            <article
              key={`${branch.branch_id}-${branch.replay_hash}`}
              className={`rounded-xl border p-3 ${
                isActiveBranch || isCompareTarget
                  ? "border-violet-400/60 bg-violet-950/25 ring-1 ring-violet-400/30"
                  : "border-violet-500/30 bg-violet-950/15"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                  What-if branch
                </div>
                <Badge tone={branchStatusTone(branch.branch_status)}>
                  {branch.branch_status ?? "estimated"}
                </Badge>
              </div>
              <div className="mt-1 text-[13px] font-bold text-darla-text">{branch.branch_id}</div>
              {branch.action ? (
                <div className="mt-1 text-[11px] text-darla-text-muted">
                  do({formatCoaAction(branch.action)}) on {branch.target} at T+
                  {branch.scheduled_at_tick ?? "?"}
                </div>
              ) : null}
              <dl className="mt-3 space-y-1.5 text-[11px]">
                <Row
                  label="Mission delta"
                  value={`${branch.mission_delta >= 0 ? "+" : ""}${branch.mission_delta.toFixed(3)}`}
                  valueClass={deltaClass(missionTone)}
                />
                <Row
                  label="Detection delta"
                  value={`${branch.detection_time_delta >= 0 ? "+" : ""}${branch.detection_time_delta} ticks`}
                  valueClass={deltaClass(detectionTone)}
                />
                {branchMetrics ? (
                  <>
                    <Row
                      label="Branch mission"
                      value={branchMetrics.mission_success_score.toFixed(3)}
                      valueClass="text-violet-200"
                    />
                    <Row
                      label="Branch detection"
                      value={
                        branchMetrics.target_detected
                          ? `T+${branchMetrics.detection_time}`
                          : "Not detected"
                      }
                    />
                  </>
                ) : null}
                <Row
                  label="Risk delta"
                  value={`${branch.risk_delta >= 0 ? "+" : ""}${branch.risk_delta.toFixed(3)}`}
                />
                <Row label="Branch run" value={branch.branch_run_id?.slice(0, 12) ?? "—"} mono />
                <Row label="Replay hash" value={branch.replay_hash.slice(0, 12)} mono />
              </dl>
              {branch.branch_run_id ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="darla-btn darla-btn-primary py-1 text-[10px]"
                    disabled={isActiveBranch}
                    onClick={() => onOpenBranchReplay(branch)}
                  >
                    {isActiveBranch ? "Viewing branch" : "Open branch replay"}
                  </button>
                  <button
                    type="button"
                    className="darla-btn py-1 text-[10px]"
                    disabled={isCompareTarget}
                    onClick={() => onStartCompare(branch)}
                  >
                    {isCompareTarget ? "Comparing" : "Compare side-by-side"}
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {replayView !== "baseline" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {replayView === "compare" ? (
            <button type="button" className="darla-btn py-1 text-[10px]" onClick={onStopCompare}>
              Exit compare mode
            </button>
          ) : null}
          <button type="button" className="darla-btn py-1 text-[10px]" onClick={onReturnToBaseline}>
            Return to baseline replay
          </button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="mt-3 text-[11px] text-darla-text-muted">
          Use <span className="text-darla-text-secondary">Simulate What-If</span> to fork a
          counterfactual branch run with explicit COA approval and compare outcomes here.
        </p>
      ) : null}
    </section>
  );
}

function Row({
  label,
  value,
  mono,
  valueClass = "text-darla-text",
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-darla-text-muted">{label}</dt>
      <dd className={`font-semibold ${mono ? "font-mono" : ""} ${valueClass}`}>{value}</dd>
    </div>
  );
}
