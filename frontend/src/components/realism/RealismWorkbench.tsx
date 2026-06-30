import { useMemo, useState } from "react";
import { buildRuntimeCausalEvidence } from "../../realism/causalEvidence";
import { assessCoaRealism } from "../../realism/coaEvaluation";
import {
  buildBranchOutcomeDistributions,
  buildEvidenceBundlePreview,
  buildUncertaintyMetrics,
  buildValidityEnvelopes,
} from "../../realism/deriveRealism";
import type { CourseOfAction, DashboardData, RelationshipEdge, RunIdentity, SimEvent, TemporalCausalEdge } from "../../types";
import type { PlaybackFrame } from "../../playback";
import BranchOutcomePanel from "./BranchOutcomePanel";
import CapabilitySummaryStrip from "./CapabilitySummaryStrip";
import COARealismPanel from "./COARealismPanel";
import EvidenceBundlePanel from "./EvidenceBundlePanel";
import RuntimeCausalEvidencePanel from "./RuntimeCausalEvidencePanel";
import UncertaintyPanel from "./UncertaintyPanel";
import ValidityEnvelopePanel from "./ValidityEnvelopePanel";
import type { BranchResult } from "../../types";
import type { RunEvidenceSummary } from "../../realism/types";

type RealismWorkbenchProps = {
  scenario: string;
  dashboard: DashboardData | null;
  runIdentity: RunIdentity | null;
  currentTick: number;
  currentFrame: PlaybackFrame | null;
  events: SimEvent[];
  timelineEvents: SimEvent[];
  relationships: RelationshipEdge[];
  temporalEdges?: TemporalCausalEdge[];
  coas: CourseOfAction[];
  branchResults: BranchResult[];
  compact?: boolean;
  runEvidence?: RunEvidenceSummary | null;
  evidenceLoading?: boolean;
  evidenceError?: string | null;
};

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "causal", label: "Causal Evidence" },
  { id: "coas", label: "COA Gates" },
  { id: "validity", label: "Validity" },
  { id: "bundle", label: "Evidence Bundle" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export default function RealismWorkbench({
  scenario,
  dashboard,
  runIdentity,
  currentTick,
  currentFrame,
  events,
  timelineEvents,
  relationships,
  temporalEdges = [],
  coas,
  branchResults,
  compact = false,
  runEvidence = null,
  evidenceLoading = false,
  evidenceError = null,
}: RealismWorkbenchProps) {
  const [section, setSection] = useState<SectionId>("overview");
  const derivedRuntimeEdges = useMemo(
    () => buildRuntimeCausalEvidence(timelineEvents.length ? timelineEvents : events, temporalEdges, relationships),
    [events, relationships, temporalEdges, timelineEvents],
  );
  const derivedCoaAssessments = useMemo(() => assessCoaRealism(coas), [coas]);
  const derivedUncertaintyMetrics = useMemo(
    () => buildUncertaintyMetrics(currentFrame, dashboard, events),
    [currentFrame, dashboard, events],
  );
  const derivedValidityEnvelopes = useMemo(() => buildValidityEnvelopes(dashboard, scenario), [dashboard, scenario]);
  const runtimeEdges = runEvidence?.runtimeCausalEdges?.length ? runEvidence.runtimeCausalEdges : derivedRuntimeEdges;
  const coaAssessments = runEvidence?.coaGateResults?.length ? runEvidence.coaGateResults : derivedCoaAssessments;
  const uncertaintyMetrics = runEvidence?.uncertaintyBands?.length ? runEvidence.uncertaintyBands : derivedUncertaintyMetrics;
  const validityEnvelopes = runEvidence?.validityEnvelope?.length ? runEvidence.validityEnvelope : derivedValidityEnvelopes;
  const bundle = runEvidence?.evidenceBundle ?? buildEvidenceBundlePreview({
    dashboard,
    runIdentity,
    currentTick,
    events: timelineEvents.length ? timelineEvents : events,
    runtimeEdges,
    coas,
  });
  const branchOutcomes = runEvidence?.branchComparisons?.length
    ? runEvidence.branchComparisons
    : buildBranchOutcomeDistributions(branchResults);
  const evidenceSourceLabel = runEvidence ? "Run Evidence API" : "Local fallback derivation";

  const content = (() => {
    switch (section) {
      case "causal":
        return <RuntimeCausalEvidencePanel edges={runtimeEdges} maxItems={compact ? 4 : 12} />;
      case "coas":
        return (
          <div className="space-y-3">
            <COARealismPanel assessments={coaAssessments} maxItems={compact ? 4 : 12} />
            <BranchOutcomePanel outcomes={branchOutcomes} />
          </div>
        );
      case "validity":
        return <ValidityEnvelopePanel envelopes={validityEnvelopes} />;
      case "bundle":
        return <EvidenceBundlePanel bundle={bundle} />;
      default:
        return (
          <div className="space-y-3">
            <CapabilitySummaryStrip
              runtimeEdges={runtimeEdges}
              coaAssessments={coaAssessments}
              uncertaintyMetrics={uncertaintyMetrics}
              validityEnvelopes={validityEnvelopes}
              bundle={bundle}
            />
            <div className="grid gap-3 2xl:grid-cols-2">
              <UncertaintyPanel metrics={uncertaintyMetrics} />
              <RuntimeCausalEvidencePanel edges={runtimeEdges} maxItems={5} />
              <COARealismPanel assessments={coaAssessments} maxItems={4} />
              <ValidityEnvelopePanel envelopes={validityEnvelopes} />
            </div>
            <EvidenceBundlePanel bundle={bundle} />
          </div>
        );
    }
  })();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="shrink-0 rounded-xl border border-darla-border bg-darla-panel p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-darla-text">Realism & evidence workbench</h1>
            <p className="mt-1 max-w-4xl text-[12px] leading-relaxed text-darla-text-muted">
              Wires run evidence into the UI: uncertainty bands, runtime causal support scoring, COA gates, model validity envelopes, branch outcomes, and exportable evidence bundles.
            </p>
            <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
              <span className="rounded border border-darla-border bg-darla-bg/50 px-2 py-0.5 text-darla-text-muted">
                source: <span className="text-darla-text-secondary">{evidenceSourceLabel}</span>
              </span>
              {evidenceLoading ? (
                <span className="rounded border border-blue-900/50 bg-blue-950/30 px-2 py-0.5 text-blue-200">refreshing evidence</span>
              ) : null}
              {evidenceError ? (
                <span className="rounded border border-amber-800/60 bg-amber-950/30 px-2 py-0.5 text-amber-200">API fallback active</span>
              ) : null}
            </div>
          </div>
          <div className="rounded-lg border border-darla-border bg-darla-bg/60 px-3 py-2 text-right text-[10px] text-darla-text-muted">
            <div>tick <span className="font-mono text-darla-text-secondary">T+{currentTick}</span></div>
            <div>run <span className="font-mono text-darla-text-secondary">{runEvidence?.runId.slice(0, 8) ?? runIdentity?.run_id.slice(0, 8) ?? "pending"}</span></div>
            <div>status <span className="font-mono text-darla-text-secondary">{runEvidence?.status ?? "local"}</span></div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`rounded-md border px-2.5 py-1.5 text-[11px] transition-colors ${
                section === item.id
                  ? "border-darla-blue/50 bg-darla-blue-soft/30 text-darla-blue"
                  : "border-darla-border text-darla-text-muted hover:border-darla-border-subtle hover:text-darla-text-secondary"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="darla-scroll min-h-0 flex-1 overflow-y-auto pr-1">{content}</div>
    </div>
  );
}
