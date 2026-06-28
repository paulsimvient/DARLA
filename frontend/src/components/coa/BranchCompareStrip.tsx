import type { BranchResult, MissionMetrics } from "../../types";

type BranchCompareStripProps = {
  tick: number;
  baselineLabel: string;
  branchLabel: string;
  baselineMetrics: MissionMetrics | null;
  branchMetrics: MissionMetrics | null;
  branchResult?: BranchResult | null;
};

function metricRow(
  label: string,
  baseline: string,
  branch: string,
  delta?: string,
  deltaClass?: string,
) {
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 border-b border-darla-border/60 py-1.5 text-[11px] last:border-0">
      <span className="text-darla-text-muted">{label}</span>
      <span className="font-mono text-sky-200">{baseline}</span>
      <span className="font-mono text-violet-200">{branch}</span>
      {delta ? <span className={`font-mono ${deltaClass ?? "text-darla-text-secondary"}`}>{delta}</span> : <span />}
    </div>
  );
}

export default function BranchCompareStrip({
  tick,
  baselineLabel,
  branchLabel,
  baselineMetrics,
  branchMetrics,
  branchResult,
}: BranchCompareStripProps) {
  if (!baselineMetrics && !branchMetrics) {
    return (
      <div className="rounded-xl border border-darla-border bg-darla-bg/80 px-3 py-2 text-[11px] text-darla-text-muted">
        Waiting for branch replay frames at T+{tick}…
      </div>
    );
  }

  const scoreDelta =
    baselineMetrics && branchMetrics
      ? branchMetrics.mission_success_score - baselineMetrics.mission_success_score
      : null;
  const detectionDelta =
    baselineMetrics && branchMetrics
      ? branchMetrics.detection_time - baselineMetrics.detection_time
      : null;

  return (
    <section className="rounded-xl border border-darla-border bg-darla-panel/90 p-3 shadow-lg">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[12px] font-bold text-darla-text">Tick-synced comparison · T+{tick}</div>
          <div className="text-[10px] text-darla-text-muted">
            Baseline replay vs branch replay at the same simulation tick
          </div>
        </div>
        {branchResult?.branch_status ? (
          <span className="rounded-full border border-violet-500/30 bg-violet-950/30 px-2 py-0.5 text-[10px] text-violet-200">
            branch {branchResult.branch_status}
          </span>
        ) : null}
      </div>

      <div className="mb-2 grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-[10px] font-semibold uppercase tracking-wide text-darla-text-muted">
        <span>Metric</span>
        <span>{baselineLabel}</span>
        <span>{branchLabel}</span>
        <span>Δ</span>
      </div>

      {metricRow(
        "Mission score",
        baselineMetrics ? baselineMetrics.mission_success_score.toFixed(3) : "—",
        branchMetrics ? branchMetrics.mission_success_score.toFixed(3) : "—",
        scoreDelta != null ? `${scoreDelta >= 0 ? "+" : ""}${scoreDelta.toFixed(3)}` : undefined,
        scoreDelta != null && scoreDelta > 0.05
          ? "text-emerald-400"
          : scoreDelta != null && scoreDelta < -0.05
            ? "text-red-400"
            : undefined,
      )}
      {metricRow(
        "Detection",
        baselineMetrics?.target_detected ? `T+${baselineMetrics.detection_time}` : "none",
        branchMetrics?.target_detected ? `T+${branchMetrics.detection_time}` : "none",
        detectionDelta != null ? `${detectionDelta >= 0 ? "+" : ""}${detectionDelta}` : undefined,
        detectionDelta != null && detectionDelta < 0
          ? "text-emerald-400"
          : detectionDelta != null && detectionDelta > 0
            ? "text-red-400"
            : undefined,
      )}
      {metricRow(
        "Mission success",
        baselineMetrics ? (baselineMetrics.mission_success ? "yes" : "no") : "—",
        branchMetrics ? (branchMetrics.mission_success ? "yes" : "no") : "—",
      )}
    </section>
  );
}

export function metricsFromFrame(frame: { metrics?: MissionMetrics } | null): MissionMetrics | null {
  return frame?.metrics ?? null;
}
