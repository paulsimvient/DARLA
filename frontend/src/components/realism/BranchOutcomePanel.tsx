import type { BranchOutcomeDistribution } from "../../realism/types";
import ScoreBar from "./ScoreBar";

type BranchOutcomePanelProps = {
  outcomes: BranchOutcomeDistribution[];
};

export default function BranchOutcomePanel({ outcomes }: BranchOutcomePanelProps) {
  return (
    <section className="rounded-xl border border-darla-border bg-darla-panel p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-darla-text-secondary">Branch outcome comparison</h3>
          <p className="mt-1 text-[11px] text-darla-text-muted">
            Converts what-if branches into distribution-style outcome cards for more realistic COA review.
          </p>
        </div>
        <span className="rounded border border-darla-border px-2 py-1 font-mono text-[10px] text-darla-text-muted">
          {outcomes.length} branches
        </span>
      </div>

      {outcomes.length === 0 ? (
        <div className="rounded-lg border border-darla-border/70 bg-darla-surface/60 p-3 text-[11px] text-darla-text-muted">
          No what-if branch results yet. Select a COA and run “Simulate What-If” to populate this section.
        </div>
      ) : (
        <div className="grid gap-2 xl:grid-cols-2">
          {outcomes.map((outcome) => (
            <div key={outcome.branchId} className="rounded-lg border border-darla-border/70 bg-darla-surface/60 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-semibold text-darla-text">{outcome.label}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-darla-text-muted">{outcome.branchId}</div>
                </div>
                <span className="rounded border border-darla-border px-1.5 py-0.5 text-[9px] uppercase text-darla-text-muted">
                  branch
                </span>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <ScoreBar value={outcome.missionSuccessProbability.mean} label={`success · 90% [${outcome.missionSuccessProbability.lower90.toFixed(2)}, ${outcome.missionSuccessProbability.upper90.toFixed(2)}]`} tone="green" />
                <ScoreBar value={outcome.missionScore.mean} label="mission score" tone="blue" />
                <ScoreBar value={outcome.downsideRisk.mean} label="downside risk" tone={outcome.downsideRisk.mean > 0.4 ? "amber" : "neutral"} />
                <div className="text-[10px] text-darla-text-muted">
                  detection Δ <span className="font-mono text-darla-text-secondary">{Math.round(outcome.detectionTimeTicks.mean)} ticks</span>
                  <br />
                  confidence <span className="font-mono text-darla-text-secondary">{Math.round(outcome.detectionTimeTicks.confidence * 100)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
