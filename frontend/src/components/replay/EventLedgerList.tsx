import { useMemo } from "react";
import type { SimEvent } from "../../types";
import { filterKeyEvents, formatEventTitle } from "../../utils/keyEvents";
import { eventSummaryLine, inferEventLane, laneMeta } from "../../utils/eventCategories";

type EventLedgerListProps = {
  events: SimEvent[];
  currentTick: number;
  selectedEventId?: number | null;
  onSelect: (event: SimEvent) => void;
};

export default function EventLedgerList({
  events,
  currentTick,
  selectedEventId,
  onSelect,
}: EventLedgerListProps) {
  const ledger = useMemo(() => {
    return filterKeyEvents(events)
      .filter((event) => event.tick <= currentTick)
      .slice(-40)
      .reverse();
  }, [events, currentTick]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-darla-border/80 bg-darla-panel/40">
      <div className="border-b border-darla-border/60 px-3 py-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-darla-text-secondary">
          Event Ledger
        </h3>
        <p className="text-[9px] text-darla-text-muted">{ledger.length} key events at or before T+{currentTick}</p>
      </div>
      <ul className="darla-scroll min-h-0 flex-1 overflow-y-auto p-1.5">
        {ledger.length === 0 ? (
          <li className="px-2 py-4 text-[11px] text-darla-text-muted">No key events recorded yet.</li>
        ) : (
          ledger.map((event) => {
            const lane = laneMeta(inferEventLane(event));
            const active = event.event_id === selectedEventId;
            return (
              <li key={event.event_id}>
                <button
                  type="button"
                  onClick={() => onSelect(event)}
                  className={`mb-1 w-full rounded-md border px-2.5 py-2 text-left transition-colors ${
                    active
                      ? "border-darla-blue bg-darla-blue/10"
                      : "border-transparent bg-transparent hover:border-darla-border hover:bg-darla-panel"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${lane.dotClass}`} />
                    <span className="font-mono text-[10px] text-darla-text-secondary">T+{event.tick}</span>
                    <span className="text-[9px] uppercase tracking-wide text-darla-text-muted">{lane.label}</span>
                  </div>
                  <div className="mt-1 line-clamp-1 text-[11px] text-darla-text">{formatEventTitle(event)}</div>
                  <div className="mt-0.5 line-clamp-1 font-mono text-[9px] text-darla-text-muted">
                    {eventSummaryLine(event)}
                  </div>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
