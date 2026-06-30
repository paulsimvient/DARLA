import type { CoaRealismAssessment, ModelValidityEnvelope, RuntimeCausalEdgeEvidence } from "../../realism/types";
import type { EvidenceBundlePreview, UncertaintyMetric } from "../../realism/deriveRealism";

type CapabilitySummaryStripProps = {
  runtimeEdges: RuntimeCausalEdgeEvidence[];
  coaAssessments: CoaRealismAssessment[];
  uncertaintyMetrics: UncertaintyMetric[];
  validityEnvelopes: ModelValidityEnvelope[];
  bundle: EvidenceBundlePreview;
};

function pct(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

export default function CapabilitySummaryStrip({
  runtimeEdges,
  coaAssessments,
  uncertaintyMetrics,
  validityEnvelopes,
  bundle,
}: CapabilitySummaryStripProps) {
  const bestEdge = runtimeEdges[0]?.totalScore ?? 0;
  const recommendable = coaAssessments.filter((item) => item.recommendedDisposition === "recommend").length;
  const escalations = coaAssessments.filter((item) => item.recommendedDisposition === "escalate").length;
  const mission = uncertaintyMetrics.find((item) => item.id === "mission_success")?.band.mean ?? 0;
  const lowConfidenceModels = validityEnvelopes.filter((item) => item.confidence === "low").length;

  const cards = [
    {
      label: "Runtime causal support",
      value: pct(bestEdge),
      sub: `${runtimeEdges.length} candidate edge${runtimeEdges.length === 1 ? "" : "s"}`,
      tone: bestEdge >= 0.65 ? "text-emerald-300" : bestEdge >= 0.4 ? "text-amber-300" : "text-darla-text-secondary",
    },
    {
      label: "COA gate result",
      value: `${recommendable}/${coaAssessments.length || 0}`,
      sub: escalations > 0 ? `${escalations} escalation${escalations === 1 ? "" : "s"}` : "authority/preconditions checked",
      tone: recommendable > 0 ? "text-emerald-300" : "text-amber-300",
    },
    {
      label: "Mission probability",
      value: pct(mission),
      sub: "uncertainty band active",
      tone: mission >= 0.65 ? "text-emerald-300" : mission >= 0.45 ? "text-amber-300" : "text-red-300",
    },
    {
      label: "Validity envelopes",
      value: `${validityEnvelopes.length}`,
      sub: lowConfidenceModels ? `${lowConfidenceModels} low-confidence model${lowConfidenceModels === 1 ? "" : "s"}` : "inside declared scope",
      tone: lowConfidenceModels ? "text-amber-300" : "text-emerald-300",
    },
    {
      label: "Evidence bundle",
      value: `${bundle.eventCount}`,
      sub: `${bundle.runtimeEdgeCount} edges · ${bundle.coaCount} COAs`,
      tone: bundle.warnings.length ? "text-amber-300" : "text-emerald-300",
    },
  ];

  return (
    <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-darla-border bg-darla-panel p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-darla-text-muted">{card.label}</div>
          <div className={`mt-1 font-mono text-2xl font-bold ${card.tone}`}>{card.value}</div>
          <div className="mt-1 truncate text-[10px] text-darla-text-muted">{card.sub}</div>
        </div>
      ))}
    </section>
  );
}
