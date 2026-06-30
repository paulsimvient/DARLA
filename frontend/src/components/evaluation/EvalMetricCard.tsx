import type { EvalMetric } from "../../evaluation/types";
import { pct } from "../../evaluation/evalUi";
import EvalStatusBadge from "./EvalStatusBadge";

export default function EvalMetricCard({ metric }: { metric: EvalMetric }) {
  const value = metric.unit === "%" || metric.value <= 1 ? pct(metric.value) : `${metric.value.toFixed(2)}${metric.unit ?? ""}`;
  return (
    <article className="rounded-xl border border-darla-border bg-darla-panel p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-darla-text-muted">{metric.label}</div>
          <div className="mt-1 text-2xl font-semibold text-darla-text">{value}</div>
        </div>
        <EvalStatusBadge status={metric.status} />
      </div>
      {metric.target ? <div className="mt-2 text-[11px] text-darla-text-muted">Target: {metric.target}</div> : null}
      <p className="mt-2 text-xs leading-5 text-darla-text-secondary">{metric.interpretation}</p>
    </article>
  );
}
