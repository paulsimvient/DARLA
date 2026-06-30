import type { RuntimeCausalEdgeEvidence } from "../../realism/types";
import ScoreBar from "./ScoreBar";

type RuntimeCausalEvidencePanelProps = {
  edges: RuntimeCausalEdgeEvidence[];
  maxItems?: number;
};

export default function RuntimeCausalEvidencePanel({ edges, maxItems = 8 }: RuntimeCausalEvidencePanelProps) {
  const shown = edges.slice(0, maxItems);
  return (
    <section className="rounded-xl border border-darla-border bg-darla-panel p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-darla-text-secondary">
            Runtime causal evidence
          </h3>
          <p className="mt-1 text-[11px] text-darla-text-muted">
            Candidate edges scored from temporal order, deltas, relationship priors, branch/intervention support, and confound penalties.
          </p>
        </div>
        <span className="rounded border border-darla-border px-2 py-1 font-mono text-[10px] text-darla-text-muted">
          {edges.length} edges
        </span>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-darla-border/70 bg-darla-surface/60 p-3 text-[11px] text-darla-text-muted">
          No runtime edge has enough support yet. Run or scrub to a tick with cyber/sensor/COA events.
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((edge) => (
            <div key={`${edge.source}->${edge.target}`} className="rounded-lg border border-darla-border/70 bg-darla-surface/60 p-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-semibold text-darla-text">
                    {edge.source} <span className="text-darla-text-muted">→</span> {edge.target}
                  </div>
                  <div className="mt-1 text-[10px] text-darla-text-muted">{edge.explanation}</div>
                </div>
                <span className="rounded border border-darla-border px-1.5 py-0.5 font-mono text-[10px] text-darla-text-secondary">
                  {edge.totalScore.toFixed(2)}
                </span>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                <ScoreBar value={edge.temporalPrecedence} label="temporal" tone="green" />
                <ScoreBar value={edge.stateDeltaSupport} label="state Δ" tone="blue" />
                <ScoreBar value={edge.interventionContrast} label="intervention" tone="amber" />
                <ScoreBar value={edge.counterfactualSupport} label="counterfactual" tone="green" />
                <ScoreBar value={edge.relationshipPrior} label="domain prior" tone="neutral" />
                <ScoreBar value={Math.max(0, 1 - edge.confoundingPenalty)} label="confound clear" tone={edge.confoundingPenalty > 0.2 ? "amber" : "green"} />
              </div>
              <div className="mt-2 truncate font-mono text-[10px] text-darla-text-muted">
                evidence events: {edge.supportingEventIds.join(", ") || "—"}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
