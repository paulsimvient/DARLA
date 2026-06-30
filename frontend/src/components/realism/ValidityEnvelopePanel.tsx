import type { ModelValidityEnvelope } from "../../realism/types";

function confidenceClass(confidence: ModelValidityEnvelope["confidence"]) {
  if (confidence === "high") return "border-emerald-700/60 bg-emerald-950/30 text-emerald-200";
  if (confidence === "medium") return "border-blue-700/60 bg-blue-950/30 text-blue-200";
  return "border-amber-700/60 bg-amber-950/30 text-amber-200";
}

type ValidityEnvelopePanelProps = {
  envelopes: ModelValidityEnvelope[];
};

export default function ValidityEnvelopePanel({ envelopes }: ValidityEnvelopePanelProps) {
  return (
    <section className="rounded-xl border border-darla-border bg-darla-panel p-3">
      <div className="mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-darla-text-secondary">Model validity envelopes</h3>
        <p className="mt-1 text-[11px] text-darla-text-muted">
          Shows where each model is intended to be trusted and where the demo should not overclaim.
        </p>
      </div>

      <div className="grid gap-2 xl:grid-cols-3">
        {envelopes.map((envelope) => (
          <article key={envelope.modelId} className="rounded-lg border border-darla-border/70 bg-darla-surface/60 p-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold text-darla-text">{envelope.modelId}</div>
                <div className="mt-0.5 text-[10px] text-darla-text-muted">{envelope.domain}</div>
              </div>
              <span className={`rounded border px-1.5 py-0.5 text-[9px] uppercase ${confidenceClass(envelope.confidence)}`}>
                {envelope.confidence}
              </span>
            </div>

            <div className="mt-2 grid gap-2 text-[10px] text-darla-text-muted md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div>
                <div className="mb-1 font-semibold uppercase tracking-wide text-emerald-300/90">Valid for</div>
                <ul className="space-y-0.5">
                  {envelope.validFor.slice(0, 4).map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="mb-1 font-semibold uppercase tracking-wide text-red-300/90">Not valid for</div>
                <ul className="space-y-0.5">
                  {envelope.notValidFor.slice(0, 4).map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-2 rounded border border-darla-border/60 bg-darla-bg/40 p-1.5 text-[10px] text-darla-text-muted">
              <span className="text-darla-text-secondary">Calibration:</span> {envelope.calibrationBasis.replace(/_/g, " ")}
              <br />
              <span className="text-darla-text-secondary">Assumption:</span> {envelope.assumptions[0] ?? "—"}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
