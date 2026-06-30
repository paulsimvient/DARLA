import type { EvidenceBundlePreview } from "../../realism/deriveRealism";

type EvidenceBundlePanelProps = {
  bundle: EvidenceBundlePreview;
};

export default function EvidenceBundlePanel({ bundle }: EvidenceBundlePanelProps) {
  return (
    <section className="rounded-xl border border-darla-border bg-darla-panel p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-darla-text-secondary">Evidence bundle preview</h3>
          <p className="mt-1 text-[11px] text-darla-text-muted">
            What this run can export for replay, audit, causal trace, COA review, and VV&A-style review.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded border border-darla-border px-2 py-1 font-mono text-[10px] text-darla-text-muted">
            T+{bundle.currentTick}
          </span>
          {bundle.runId !== "pending-run" ? (
            <a
              href={`/api/runs/${bundle.runId}/evidence-bundle?download=1`}
              className="rounded border border-darla-blue/50 bg-darla-blue-soft/20 px-2 py-1 text-[10px] font-semibold text-darla-blue hover:bg-darla-blue-soft/30"
            >
              Export JSON
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-darla-border/70 bg-darla-surface/60 p-2">
          <div className="grid gap-1 text-[11px] text-darla-text-muted md:grid-cols-2">
            <BundleRow label="run" value={bundle.runId} mono />
            <BundleRow label="scenario" value={bundle.scenarioId} />
            <BundleRow label="seed" value={bundle.seed} mono />
            <BundleRow label="replay hash" value={bundle.replayHash} mono />
            <BundleRow label="events" value={String(bundle.eventCount)} mono />
            <BundleRow label="runtime edges" value={String(bundle.runtimeEdgeCount)} mono />
            <BundleRow label="COAs" value={String(bundle.coaCount)} mono />
            <BundleRow label="credibility" value={String(bundle.credibilityCount)} mono />
          </div>
        </div>

        <div className="rounded-lg border border-darla-border/70 bg-darla-surface/60 p-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-darla-text-muted">Bundle contents</div>
          <div className="grid gap-1 text-[10px] text-darla-text-muted md:grid-cols-2">
            {bundle.contents.map((item) => (
              <span key={item} className="rounded border border-darla-border/60 bg-darla-bg/40 px-1.5 py-1 font-mono">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {bundle.warnings.length > 0 ? (
        <div className="mt-2 rounded-lg border border-amber-800/60 bg-amber-950/20 p-2 text-[10px] text-amber-200/90">
          <div className="mb-1 font-semibold uppercase tracking-wide">Review warnings</div>
          <ul className="space-y-0.5">
            {bundle.warnings.map((warning) => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function BundleRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <span className="text-darla-text-muted">{label}: </span>
      <span className={`break-all text-darla-text-secondary ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
