import { useMemo, useState } from "react";
import type { SimEvent } from "../../types";
import { filterKeyEvents, formatEventTitle } from "../../utils/keyEvents";
import { formatSimTime } from "../../utils/simTime";
import {
  displayLaneForEvent,
  eventInRange,
  eventsInRange,
  TIMELINE_DISPLAY_LANES,
  type TickRange,
} from "../../utils/timelineGroupSelection";

type ActivityFilter = "recent" | "selection" | "all";

type RecentActivityPanelProps = {
  events: SimEvent[];
  range: TickRange | null;
  tickSeconds?: number;
  selectedEventId?: number | null;
  onSelect: (event: SimEvent) => void;
};

function laneDotClass(laneId: ReturnType<typeof displayLaneForEvent>): string {
  return TIMELINE_DISPLAY_LANES.find((lane) => lane.id === laneId)?.dotClass ?? "bg-slate-400";
}

function eventDetail(event: SimEvent): string {
  const delta = event.deltas.find((d) => d.before !== d.after);
  if (delta) return `${delta.field}: ${delta.before} → ${delta.after}`;
  return event.provenance || event.type;
}

export default function RecentActivityPanel({
  events,
  range,
  tickSeconds = 1,
  selectedEventId,
  onSelect,
}: RecentActivityPanelProps) {
  const [filter, setFilter] = useState<ActivityFilter>("recent");

  const ledger = useMemo(
    () => filterKeyEvents(events).sort((a, b) => b.tick - a.tick || b.event_id - a.event_id),
    [events],
  );

  const visible = useMemo(() => {
    if (filter === "selection") return eventsInRange(events, range);
    if (filter === "all") return ledger;
    return ledger.slice(0, 20);
  }, [events, filter, ledger, range]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-darla-border bg-darla-panel/90 shadow-[0_16px_60px_rgba(0,0,0,0.22)]">
      <div className="flex h-11 items-center justify-between border-b border-darla-border bg-darla-panel-elevated/75 px-3">
        <div>
          <div className="text-[13px] font-black text-darla-text">Recent Activity</div>
          <div className="text-[11px] text-darla-text-muted">{visible.length} events shown</div>
        </div>
        <div className="flex gap-1">
          {(["recent", "selection", "all"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilter(mode)}
              className={`rounded-md px-2 py-0.5 text-[10px] capitalize ${
                filter === mode
                  ? "bg-darla-blue/20 text-darla-text ring-1 ring-darla-blue/40"
                  : "text-darla-text-muted hover:text-darla-text"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
      <div className="darla-scroll min-h-0 flex-1 overflow-y-auto p-2.5">
        {visible.length === 0 ? (
          <div className="rounded-xl border border-darla-border bg-[#0b1018] p-3 text-xs text-darla-text-muted">
            {filter === "selection"
              ? "No key events in the selected window."
              : "Waiting for simulation events…"}
          </div>
        ) : (
          visible.map((event) => {
            const inRange = eventInRange(event, range);
            const active = event.event_id === selectedEventId;
            const laneId = displayLaneForEvent(event);
            return (
              <button
                key={event.event_id}
                type="button"
                onClick={() => onSelect(event)}
                className={`mb-2 w-full rounded-[13px] border p-2.5 text-left transition-all ${
                  active
                    ? "border-white bg-gradient-to-b from-[#11213a] to-[#0b1018]"
                    : inRange
                      ? "border-blue-500/70 bg-gradient-to-b from-[#11213a] to-[#0b1018]"
                      : "border-[#273142] bg-[#0b1018] opacity-80 hover:opacity-100"
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${laneDotClass(laneId)}`} />
                  <span className="font-mono text-[11px] text-slate-300">
                    {formatSimTime(event.tick, tickSeconds, true)}
                  </span>
                </div>
                <div className="text-[13px] font-extrabold text-darla-text">{formatEventTitle(event)}</div>
                <div className="mt-1 text-[11px] leading-snug text-darla-text-muted">{eventDetail(event)}</div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
