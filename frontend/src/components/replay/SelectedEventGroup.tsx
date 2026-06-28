import { useMemo } from "react";
import type { SimEvent } from "../../types";
import { filterKeyEvents, formatEventTitle } from "../../utils/keyEvents";
import { formatSimTime, formatSimTimeRange } from "../../utils/simTime";
import {
  displayLaneForEvent,
  eventInRange,
  eventsInRange,
  TIMELINE_DISPLAY_LANES,
  type TickRange,
} from "../../utils/timelineGroupSelection";

type SelectedEventGroupProps = {
  events: SimEvent[];
  range: TickRange | null;
  tickSeconds?: number;
  selectedEventId?: number | null;
  onSelect: (event: SimEvent) => void;
};

function laneDotClass(laneId: ReturnType<typeof displayLaneForEvent>): string {
  return TIMELINE_DISPLAY_LANES.find((lane) => lane.id === laneId)?.dotClass ?? "bg-slate-400";
}

export default function SelectedEventGroup({
  events,
  range,
  tickSeconds = 1,
  selectedEventId,
  onSelect,
}: SelectedEventGroupProps) {
  const ledger = useMemo(() => filterKeyEvents(events).sort((a, b) => b.tick - a.tick || b.event_id - a.event_id), [events]);
  const inRangeCount = eventsInRange(events, range).length;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-darla-border bg-darla-panel/90 shadow-[0_16px_60px_rgba(0,0,0,0.22)]">
      <div className="flex h-11 items-center justify-between border-b border-darla-border bg-darla-panel-elevated/75 px-3">
        <div>
          <div className="text-[13px] font-black text-darla-text">Selected Event Group</div>
          <div className="text-[11px] text-darla-text-muted">
            {range
              ? `${formatSimTimeRange(range.start, range.end, tickSeconds, true)} · ${inRangeCount} events`
              : "No range selected"}
          </div>
        </div>
        <span className="text-[11px] text-darla-text-muted">range filter</span>
      </div>
      <div className="darla-scroll min-h-0 flex-1 overflow-y-auto p-2.5">
        {ledger.map((event) => {
          const inRange = eventInRange(event, range);
          const active = event.event_id === selectedEventId;
          const laneId = displayLaneForEvent(event);
          return (
            <button
              key={event.event_id}
              type="button"
              onClick={() => onSelect(event)}
              className={`mb-2 w-full rounded-[13px] border p-2.5 text-left transition-all ${
                inRange
                  ? active
                    ? "border-white bg-gradient-to-b from-[#11213a] to-[#0b1018] opacity-100"
                    : "border-blue-500 bg-gradient-to-b from-[#11213a] to-[#0b1018] opacity-100"
                  : "border-[#273142] bg-[#0b1018] opacity-60 hover:opacity-80"
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${laneDotClass(laneId)}`} />
                <span className="font-mono text-[11px] text-slate-300">
                  {formatSimTime(event.tick, tickSeconds, true)}
                </span>
              </div>
              <div className="text-[13px] font-extrabold text-darla-text">{formatEventTitle(event)}</div>
              <div className="mt-1 text-[11px] leading-snug text-darla-text-muted">
                {event.provenance || event.type}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-[#263143] bg-[#111827] px-2 py-0.5 text-[10px] text-slate-400">
                  {laneId}
                </span>
                {inRange ? (
                  <span className="rounded-full border border-blue-500/40 bg-blue-950/40 px-2 py-0.5 text-[10px] text-blue-200">
                    in range
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
