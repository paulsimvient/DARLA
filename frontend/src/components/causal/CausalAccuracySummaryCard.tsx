import Badge from "../Badge";
import type { CausalAccuracySummary } from "../../causal/accurateCausalGraph";
import { formatPercent } from "../../causal/accurateCausalGraph";

type CausalAccuracySummaryCardProps = {
  summary: CausalAccuracySummary;
  compact?: boolean;
};

export default function CausalAccuracySummaryCard({ summary, compact = false }: CausalAccuracySummaryCardProps) {
  return (
    <div className="rounded-lg border border-darla-border bg-darla-bg/70 p-3 text-[11px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-darla-text-muted">
            Causal accuracy summary
          </div>
          <p className="mt-1 text-darla-text-secondary">{summary.topExplanation}</p>
        </div>
        <Badge tone={summary.confidenceStatus.tone}>{summary.confidenceStatus.badge}</Badge>
      </div>

      <div className={`mt-3 grid gap-2 ${compact ? "grid-cols-4" : "grid-cols-2 md:grid-cols-4"}`}>
        <Metric label="Confidence" value={formatPercent(summary.confidence)} />
        <Metric label="Runtime edges" value={String(summary.runtimeEdgeCount)} />
        <Metric label="Evidence items" value={String(summary.evidenceItemCount)} />
        <Metric label="Reportability" value={summary.reportability.replace("_", " ")} />
      </div>

      {!compact && summary.warnings.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-4 text-darla-text-muted">
          {summary.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {compact && summary.warnings.length > 0 ? (
        <div className="mt-2 text-[10px] text-amber-300">
          {summary.warnings[0]}
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-darla-border bg-darla-panel px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-darla-text-muted">{label}</div>
      <div className="mt-0.5 font-semibold capitalize text-darla-text-secondary">{value}</div>
    </div>
  );
}
