import { useState } from "react";
import type { CourseOfAction, SimEvent } from "../../types";
import {
  eventImplications,
  eventStateChanges,
  inferEventLane,
  laneMeta,
  relatedCoasForEvent,
} from "../../utils/eventCategories";
import { formatEventTitle } from "../../utils/keyEvents";
import { markerHeadline, markerInspectPrompt } from "../../utils/timelineMarkers";
import { displayLaneForEvent } from "../../utils/timelineGroupSelection";
import { formatCoaAction } from "../../utils/coaHelpers";
import MetricRow from "../MetricRow";

type EventDetailPanelProps = {
  event: SimEvent;
  missionCutoff: number;
  coaLog?: CourseOfAction[];
  onOpenCausal?: () => void;
  onBranch?: (event: SimEvent, coa: CourseOfAction | null) => Promise<void>;
  onSelectCoa?: (coaId: number) => void;
};

export default function EventDetailPanel({
  event,
  missionCutoff,
  coaLog,
  onOpenCausal,
  onBranch,
  onSelectCoa,
}: EventDetailPanelProps) {
  const [branchBusy, setBranchBusy] = useState(false);
  const lane = laneMeta(inferEventLane(event));
  const displayLane = displayLaneForEvent(event);
  const changes = eventStateChanges(event);
  const implications = eventImplications(event, missionCutoff);
  const relatedCoas = relatedCoasForEvent(event, coaLog);
  const recommendedCoa = relatedCoas[0] ?? null;
  const pastCutoff = event.tick >= missionCutoff;
  const evidenceLines = [
    event.provenance,
    ...(event.causal_parent_events ?? []).map((parentId) => `Parent event #${parentId}`),
    ...changes.map((delta) => `${delta.field}: ${delta.before} → ${delta.after}`),
  ].filter(Boolean);

  return (
    <>
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-darla-text-muted">
          Event
        </h3>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-darla-border px-2 py-0.5 text-[10px] text-darla-text-secondary">
            <span className={`h-1.5 w-1.5 rounded-full ${lane.dotClass}`} />
            {lane.label}
          </span>
          <span className="font-mono text-[10px] text-darla-text-secondary">T+{event.tick}</span>
        </div>
        <p className="mb-2 text-sm font-semibold text-darla-text">{markerHeadline(event, displayLane)}</p>
        <p className="mb-3 text-[11px] leading-relaxed text-darla-text-muted">
          {markerInspectPrompt(displayLane)}
        </p>
        <MetricRow label="Label" value={formatEventTitle(event)} />
        <MetricRow label="Type" value={event.type} />
        <MetricRow label="Confidence" value={`${Math.round(event.confidence * 100)}%`} />
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-darla-text-muted">
          Evidence
        </h3>
        {evidenceLines.length === 0 ? (
          <p className="text-[11px] text-darla-text-muted">No structured evidence attached to this event.</p>
        ) : (
          <ul className="space-y-1.5 text-[11px] leading-relaxed text-darla-text-secondary">
            {evidenceLines.map((line, index) => (
              <li key={`evidence-${index}-${line}`} className="rounded-md border border-darla-border/60 bg-darla-panel px-2 py-1.5">
                {line}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-darla-text-muted">
          Impact
        </h3>
        {changes.length > 0 ? (
          <div className="mb-2 space-y-1.5">
            {changes.map((delta) => (
              <div key={delta.field} className="rounded-md border border-darla-border/60 bg-darla-panel px-2 py-1.5 text-[11px]">
                <div className="text-darla-text-muted">{delta.field}</div>
                <div className="mt-0.5 font-mono text-darla-text">
                  {delta.before} → {delta.after}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <ul className="space-y-1.5 text-[11px] leading-relaxed text-darla-text-secondary">
          {implications.map((line, index) => (
            <li key={`implication-${index}-${line}`} className="rounded-md bg-darla-panel/60 px-2 py-1.5">
              {line}
            </li>
          ))}
        </ul>
        {pastCutoff ? (
          <p className="mt-2 text-[10px] text-amber-300/90">
            Decision cutoff passed at T+{missionCutoff}. Branching from here explores a what-if path.
          </p>
        ) : null}
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-darla-text-muted">
          Recommended action
        </h3>
        {recommendedCoa ? (
          <>
            <button
              type="button"
              onClick={() => onSelectCoa?.(recommendedCoa.id)}
              className="mb-2 w-full rounded-lg border border-darla-blue/40 bg-darla-blue/10 p-2 text-left hover:border-darla-blue/60"
            >
              <div className="text-xs font-semibold text-darla-text">
                {formatCoaAction(recommendedCoa.action)} → {recommendedCoa.target}
              </div>
              <div className="mt-1 text-[10px] text-darla-text-muted">
                score {recommendedCoa.score.toFixed(2)} · T+{recommendedCoa.proposed_tick}
              </div>
            </button>
            {relatedCoas.length > 1 ? (
              <div className="space-y-1.5">
                {relatedCoas.slice(1).map((coa) => (
                  <button
                    key={coa.id}
                    type="button"
                    onClick={() => onSelectCoa?.(coa.id)}
                    className="w-full rounded-lg border border-darla-border bg-darla-panel p-2 text-left hover:border-darla-blue/40"
                  >
                    <div className="text-xs font-semibold text-darla-text">{formatCoaAction(coa.action)}</div>
                    <div className="mt-1 text-[10px] text-darla-text-muted">
                      {coa.target} · score {coa.score.toFixed(2)}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-[11px] text-darla-text-muted">
            No COA recommendation linked at this tick. Open causal trace to compare intervention options.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        {onOpenCausal ? (
          <button type="button" className="darla-btn w-full justify-center text-[11px]" onClick={onOpenCausal}>
            Open causal trace
          </button>
        ) : null}
        {onBranch ? (
          <button
            type="button"
            className="darla-btn w-full justify-center bg-darla-blue/20 text-[11px] text-darla-blue hover:bg-darla-blue/30"
            disabled={branchBusy}
            onClick={async () => {
              setBranchBusy(true);
              try {
                await onBranch(event, recommendedCoa);
              } finally {
                setBranchBusy(false);
              }
            }}
          >
            {branchBusy ? "Creating branch…" : "Branch from this event"}
          </button>
        ) : null}
      </section>
    </>
  );
}
