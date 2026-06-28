import { useNavigate } from "react-router-dom";
import MapPanel from "../../MapPanel";
import Badge from "../Badge";
import { RHandle, RPanel, VGroup } from "../layout/ResizableLayout";
import type { SimulationStatus } from "../../context/SimulationContext";
import { useSimulation } from "../../context/SimulationContext";
import type { PlaybackFrame } from "../../playback";
import type { CourseOfAction, MapEntity, RelationshipEdge } from "../../types";
import {
  buildCausalStripNodes,
  coaRationaleSummary,
  formatCoaAction,
} from "../../utils/coaHelpers";

type COADecisionCenterProps = {
  coa: CourseOfAction | null;
  entities: MapEntity[];
  relationships: RelationshipEdge[];
  currentTick: number;
  status: SimulationStatus;
  approvals: number[];
  authorizationMode: string;
  onOpenCausalTrace?: (coa: CourseOfAction) => void;
  currentFrame?: PlaybackFrame | null;
};

export default function COADecisionCenter({
  coa,
  entities,
  relationships,
  currentTick,
  status,
  approvals,
  authorizationMode,
  onOpenCausalTrace,
  currentFrame,
}: COADecisionCenterProps) {
  const navigate = useNavigate();
  const { approveCoa, simulateWhatIf } = useSimulation();

  if (!coa) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-2xl border border-darla-border bg-darla-panel/90 p-8 text-sm text-darla-text-muted">
        Select a COA from the ranking panel to view the decision board.
      </div>
    );
  }

  const stripNodes = buildCausalStripNodes(coa);
  const isApproved = approvals.includes(coa.id);
  const isRunning = status === "loading" || status === "live";

  return (
    <VGroup id="darla-coa-center-v" autoSaveId="darla-coa-center-v" className="h-full gap-0">
      <RPanel defaultSize={28} minSize={18} maxSize={45}>
        <section className="h-full overflow-auto rounded-2xl border border-darla-border bg-darla-panel/90 p-4 shadow-lg">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-darla-text">
                {formatCoaAction(coa.action)}
              </h1>
              <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-darla-text-muted">
                {coaRationaleSummary(coa)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {coa.status === "recommended" ? (
                  <Badge tone="green">Recommended</Badge>
                ) : (
                  <Badge tone="neutral">{coa.status}</Badge>
                )}
                {isApproved ? <Badge tone="green">Approved — sim command sent</Badge> : null}
                <Badge tone="blue">Target: {coa.target}</Badge>
                <Badge tone="orange">Causal confidence {coa.causal_confidence.toFixed(2)}</Badge>
                <Badge tone="neutral">Proposed T+{coa.proposed_tick}</Badge>
                <Badge tone="neutral">Scheduled T+{coa.scheduled_at_tick}</Badge>
                <Badge tone="neutral">{authorizationMode.replace(/_/g, " ")}</Badge>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="darla-btn darla-btn-primary py-2.5 disabled:opacity-50"
                disabled={isRunning || isApproved}
                onClick={() => void approveCoa(coa)}
              >
                {isApproved ? "Approved" : "Accept COA"}
              </button>
              <button
                type="button"
                className="darla-btn py-2.5 disabled:opacity-50"
                disabled={isRunning}
                onClick={() => void simulateWhatIf(coa)}
              >
                Simulate What-If
              </button>
              <button
                type="button"
                className="darla-btn py-2.5"
                onClick={() => onOpenCausalTrace?.(coa)}
              >
                Open Causal Trace
              </button>
              <button
                type="button"
                className="darla-btn py-2.5"
                onClick={() =>
                  navigate("/map", {
                    state: {
                      entityId: coa.target,
                      coaId: coa.id,
                      coaAction: coa.action,
                    },
                  })
                }
              >
                Push Overlay to Map
              </button>
            </div>
          </div>
        </section>
      </RPanel>
      <RHandle />
      <RPanel defaultSize={44} minSize={25}>
        <section className="relative h-full min-h-0 overflow-hidden rounded-2xl border border-darla-border bg-[#0b111a] shadow-lg">
          <div className="absolute left-3 top-3 z-10 rounded-full border border-darla-border bg-darla-bg/80 px-3 py-1.5 text-[11px] text-darla-text-secondary backdrop-blur-sm">
            Map preview: {formatCoaAction(coa.action)} on {coa.target} · T+{currentTick}
          </div>
          <MapPanel
            entities={entities}
            relationships={relationships}
            currentTick={currentTick}
            selectedEntityId={coa.target}
            coaOverlay={{ id: coa.id, action: coa.action, target: coa.target }}
            simOverlays={currentFrame?.map_overlays ?? []}
            showChrome={false}
            className="h-full min-h-0 rounded-none border-0"
          />
        </section>
      </RPanel>
      <RHandle />
      <RPanel defaultSize={28} minSize={18} maxSize={45}>
        <section className="h-full overflow-auto rounded-2xl border border-darla-border bg-darla-panel/90 p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[13px] font-bold text-darla-text">Causal explanation</div>
            <div className="text-[11px] text-darla-text-muted">Observation → effect → COA → outcome</div>
          </div>
          <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
            {stripNodes.map((node, index) => (
              <div key={`${node.label}-${index}`} className="flex min-w-0 items-center gap-1">
                <div
                  className={`min-w-[140px] max-w-[170px] shrink-0 rounded-2xl border p-3 ${
                    node.kind === "action"
                      ? "border-emerald-900/60 bg-emerald-950/20"
                      : node.kind === "outcome"
                        ? "border-violet-900/60 bg-violet-950/20"
                        : "border-darla-border bg-darla-bg"
                  }`}
                >
                  <div className="text-[12px] font-bold leading-snug text-darla-text">{node.label}</div>
                  <div className="mt-1 text-[10px] text-darla-text-muted">{node.subtitle}</div>
                </div>
                {index < stripNodes.length - 1 ? <Arrow /> : null}
              </div>
            ))}
          </div>
        </section>
      </RPanel>
    </VGroup>
  );
}

function Arrow() {
  return (
    <div className="flex w-8 shrink-0 items-center px-1">
      <div className="relative h-0.5 w-full bg-slate-600">
        <span className="absolute -right-0.5 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[5px] border-l-[8px] border-y-transparent border-l-slate-600" />
      </div>
    </div>
  );
}
