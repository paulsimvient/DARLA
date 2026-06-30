import type { CourseOfAction, RelationshipEdge, SimEvent, TemporalCausalEdge } from "../../types";
import { buildRuntimeCausalEvidence } from "../../realism/causalEvidence";
import { assessCoaRealism } from "../../realism/coaEvaluation";

type RealismEvidencePanelProps = {
  events: SimEvent[];
  relationships: RelationshipEdge[];
  temporalEdges?: TemporalCausalEdge[];
  coas?: CourseOfAction[];
};

export default function RealismEvidencePanel({
  events,
  relationships,
  temporalEdges = [],
  coas = [],
}: RealismEvidencePanelProps) {
  const runtimeEdges = buildRuntimeCausalEvidence(events, temporalEdges, relationships).slice(0, 5);
  const assessments = assessCoaRealism(coas).slice(0, 4);

  return (
    <section className="rounded-xl border border-darla-border bg-darla-panel p-3">
      <div className="mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-darla-text-secondary">
          Realism / Evidence Check
        </h3>
        <p className="mt-1 text-[11px] text-darla-text-muted">
          Runtime causal edges, uncertainty-aware COA checks, and explicit abstention/escalation signals.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-darla-text-muted">
            Runtime causal support
          </h4>
          {runtimeEdges.length === 0 ? (
            <p className="text-[11px] text-darla-text-muted">No runtime causal edges available for this frame.</p>
          ) : (
            runtimeEdges.map((edge) => (
              <div key={`${edge.source}->${edge.target}`} className="rounded-lg border border-darla-border/70 bg-darla-surface/60 p-2">
                <div className="text-[11px] font-semibold text-darla-text">
                  {edge.source} → {edge.target}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-darla-text-muted">
                  <span>score {edge.totalScore.toFixed(2)}</span>
                  <span>temporal {edge.temporalPrecedence.toFixed(2)}</span>
                  <span>intervention {edge.interventionContrast.toFixed(2)}</span>
                  <span>confound penalty {edge.confoundingPenalty.toFixed(2)}</span>
                </div>
                <p className="mt-1 text-[10px] text-darla-text-muted">{edge.explanation}</p>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-darla-text-muted">
            COA realism gates
          </h4>
          {assessments.length === 0 ? (
            <p className="text-[11px] text-darla-text-muted">No COAs available at this moment.</p>
          ) : (
            assessments.map((item) => (
              <div key={item.coa.id} className="rounded-lg border border-darla-border/70 bg-darla-surface/60 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-darla-text">{item.coa.action}</span>
                  <span className="rounded border border-darla-border px-1.5 py-0.5 text-[9px] uppercase text-darla-text-muted">
                    {item.recommendedDisposition}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-darla-text-muted">
                  gain {item.expectedMissionGain.mean.toFixed(2)} [{item.expectedMissionGain.lower90.toFixed(2)}, {item.expectedMissionGain.upper90.toFixed(2)}]
                  · authority {item.authoritySatisfied ? "yes" : "no"}
                  · preconditions {item.preconditionsSatisfied ? "yes" : "no"}
                </div>
                <p className="mt-1 text-[10px] text-darla-text-muted">{item.rationale}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
