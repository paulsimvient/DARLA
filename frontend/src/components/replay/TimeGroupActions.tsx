import type { ReactNode } from "react";
import type { CourseOfAction } from "../../types";
import type { GroupSummary } from "../../utils/timelineGroupSelection";
import { formatSimTimeRange } from "../../utils/simTime";
import { groupStoryLines, isRangeActive, type TickRange } from "../../utils/timelineGroupSelection";
import type { SimEvent } from "../../types";

type TimeGroupActionsProps = {
  events: SimEvent[];
  range: TickRange | null;
  summary: GroupSummary;
  tickSeconds?: number;
  bestCoa: CourseOfAction | null;
  timelineMode?: "follow" | "inspect";
  liveTick?: number;
  reviewHold?: { tick: number; coa_ids: number[] } | null;
  onCreateBranch?: () => void;
  onOpenGroupCausal?: () => void;
  onCaptureMoment?: () => void;
  onFollowLive?: () => void;
  onContinueReview?: () => void;
  busy?: boolean;
  embedded?: boolean;
};

export default function TimeGroupActions({
  events,
  range,
  summary,
  tickSeconds = 1,
  bestCoa,
  timelineMode = "inspect",
  liveTick = 0,
  reviewHold,
  onCreateBranch,
  onOpenGroupCausal,
  onCaptureMoment,
  onFollowLive,
  onContinueReview,
  busy = false,
  embedded = false,
}: TimeGroupActionsProps) {
  const story = groupStoryLines(events, range, tickSeconds);
  const hasSelection = isRangeActive(range);
  const inspectingLive = timelineMode === "inspect" && liveTick > 0;

  return (
    <div
      className={
        embedded
          ? "flex min-h-0 flex-col"
          : "flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-darla-border bg-darla-panel/90 shadow-[0_16px_60px_rgba(0,0,0,0.22)]"
      }
    >
      {!embedded ? (
        <div className="flex h-11 items-center justify-between border-b border-darla-border bg-darla-panel-elevated/75 px-3">
          <div>
            <div className="text-[13px] font-black text-darla-text">Selected Moment</div>
            <div className="text-[11px] text-darla-text-muted">
              {inspectingLive ? "Inspecting · live continues in background" : summary.modeLabel}
            </div>
          </div>
          <span className="font-mono text-[11px] text-darla-text-muted">
            {range ? formatSimTimeRange(range.start, range.end, tickSeconds, true) : "none"}
          </span>
        </div>
      ) : null}
      <div className={embedded ? "min-h-0" : "darla-scroll min-h-0 flex-1 overflow-y-auto p-3"}>
        <div className="flex flex-wrap gap-2">
          {summary.mode === "branch" ? (
            <Badge tone="amber">Past cutoff</Badge>
          ) : null}
          {inspectingLive ? <Badge tone="blue">Inspecting</Badge> : <Badge tone="green">Follow live</Badge>}
          {reviewHold ? <Badge tone="red">Review hold T+{reviewHold.tick}</Badge> : null}
        </div>

        <h1 className="mt-3 text-lg font-bold tracking-tight text-darla-text">
          {hasSelection ? "Selected moment" : "No moment selected"}
        </h1>
        <p className="mt-1 text-xs text-darla-text-muted">{summary.summaryText}</p>
        <p className="mt-1 text-xs text-darla-text-secondary">
          {bestCoa
            ? `Top COA: ${bestCoa.action.replace(/_/g, " ")} on ${bestCoa.target}`
            : "Click an event or drag a window on the timeline to inspect."}
        </p>

        {reviewHold ? (
          <section className="mt-4 rounded-[13px] border border-amber-500/40 bg-amber-950/20 p-2.5 text-xs text-amber-100">
            Simulation paused for COA review at T+{reviewHold.tick}. Approve or reject a COA to continue.
            {onContinueReview ? (
              <button
                type="button"
                className="mt-2 block w-full rounded-md border border-amber-600 bg-amber-900/40 px-2 py-1.5 text-[11px] font-semibold text-amber-50"
                onClick={onContinueReview}
              >
                Continue without approval
              </button>
            ) : null}
          </section>
        ) : null}

        <section className="mt-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-darla-text-muted">
            Moment story
          </h3>
          <div className="grid gap-2">
            {story.map((item) => (
              <div key={item.title} className="rounded-xl border border-[#252e3e] bg-[#0b1018] p-2.5">
                <b className="block text-xs text-darla-text">{item.title}</b>
                <p className="mt-1 text-[11px] leading-snug text-darla-text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-darla-text-muted">
            Actions
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {inspectingLive && onFollowLive ? (
              <ActionButton primary onClick={onFollowLive}>
                Follow Live (T+{liveTick})
              </ActionButton>
            ) : null}
            <ActionButton primary disabled={!bestCoa || busy} onClick={onCreateBranch}>
              {busy ? "Creating branch…" : "+ Create Branch"}
            </ActionButton>
            <ActionButton disabled={!hasSelection} onClick={onCaptureMoment}>
              Capture Moment
            </ActionButton>
            <ActionButton disabled={!hasSelection} onClick={onOpenGroupCausal}>
              Open Causal Trace
            </ActionButton>
            <ActionButton disabled>Compare Before / After</ActionButton>
          </div>
        </section>
      </div>
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone: "amber" | "blue" | "green" | "red" }) {
  const toneClass =
    tone === "amber"
      ? "border-amber-500/40 bg-amber-950/30 text-amber-200"
      : tone === "blue"
        ? "border-blue-500/40 bg-blue-950/30 text-blue-200"
        : tone === "red"
          ? "border-red-500/40 bg-red-950/30 text-red-200"
          : "border-emerald-500/40 bg-emerald-950/30 text-emerald-200";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${toneClass}`}>{children}</span>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-[10px] border px-2.5 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 ${
        primary
          ? "border-none bg-blue-600 text-white"
          : "border-slate-600 bg-[#0b1220] text-blue-100"
      }`}
    >
      {children}
    </button>
  );
}
