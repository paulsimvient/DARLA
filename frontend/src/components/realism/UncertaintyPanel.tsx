import type { UncertaintyMetric } from "../../realism/deriveRealism";
import ScoreBar from "./ScoreBar";

type UncertaintyPanelProps = {
  metrics: UncertaintyMetric[];
};

export default function UncertaintyPanel({ metrics }: UncertaintyPanelProps) {
  return (
    <section className="rounded-xl border border-darla-border bg-darla-panel p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-darla-text-secondary">
            Uncertainty / belief state
          </h3>
          <p className="mt-1 text-[11px] text-darla-text-muted">
            Displays current values as 90% confidence bands so the UI stops implying fake precision.
          </p>
        </div>
        <span className="rounded border border-blue-900/50 bg-blue-950/30 px-2 py-1 text-[10px] uppercase text-blue-200">
          stochastic-ready
        </span>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.id} className="rounded-lg border border-darla-border/70 bg-darla-surface/60 p-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold text-darla-text">{metric.label}</div>
                <div className="mt-0.5 text-[10px] text-darla-text-muted">{metric.source}</div>
              </div>
              <div className="font-mono text-[12px] font-semibold text-darla-text-secondary">{metric.valueLabel}</div>
            </div>
            <div className="mt-2">
              <ScoreBar value={metric.band.mean} label={`mean · 90% [${metric.band.lower90.toFixed(2)}, ${metric.band.upper90.toFixed(2)}]`} />
            </div>
            <div className="mt-1 text-[10px] leading-relaxed text-darla-text-muted">{metric.interpretation}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
