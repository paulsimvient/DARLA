import { useMemo, useState } from "react";
import Drawer from "./Drawer";
import { typeColors } from "./EventMarker";
import { useSimulation } from "../context/SimulationContext";
import type { SimEvent } from "../types";
import {
  countRoutineEvents,
  filterKeyEvents,
  formatEventTitle,
  inferEventType,
  isRoutineEvent,
  keyEventsNearTick,
  tickPercent,
} from "../utils/keyEvents";

export default function KeyEventsTimeline({
  onOpenCausal,
  onSelectEvent,
}: {
  onOpenCausal?: (event: SimEvent) => void;
  onSelectEvent?: (eventId: number) => void;
}) {
  const { events, currentTick, setCurrentTick, dashboard, playback, liveMode, status } = useSimulation();
  const [selectedEvent, setSelectedEvent] = useState<SimEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showRoutine, setShowRoutine] = useState(false);

  const maxTick = dashboard?.max_ticks ?? playback?.final_tick ?? Math.max(currentTick, 1);
  const routineCount = useMemo(() => countRoutineEvents(events), [events]);
  const keyEvents = useMemo(() => filterKeyEvents(events), [events]);
  const nearbyEvents = useMemo(
    () => keyEventsNearTick(events, currentTick, 6),
    [events, currentTick],
  );

  const visibleRailEvents = showRoutine ? events : keyEvents;

  const handleEventClick = (event: SimEvent) => {
    setCurrentTick(event.tick);
    onSelectEvent?.(event.event_id);
    if (onOpenCausal) {
      onOpenCausal(event);
      return;
    }
    setSelectedEvent(event);
    setDrawerOpen(true);
  };

  return (
    <>
      <section className="flex h-full min-h-0 flex-col border-t border-darla-border bg-darla-bg px-4 py-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-darla-text-secondary">
              Key Events Timeline
            </h2>
            <p className="mt-0.5 text-[10px] text-darla-text-muted">
              Aligned to playback · click an event to seek
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <span className="rounded border border-darla-blue/40 bg-darla-blue/10 px-2 py-0.5 font-mono text-darla-blue">
              T+{currentTick}
            </span>
            <span className="text-darla-text-muted">/ {maxTick}</span>
            <span className="text-darla-text-secondary">
              {keyEvents.length} key
              {routineCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowRoutine((value) => !value)}
                  className="ml-1 text-darla-text-muted underline-offset-2 hover:text-darla-text hover:underline"
                >
                  · {routineCount} routine {showRoutine ? "shown" : "hidden"}
                </button>
              ) : null}
            </span>
            {liveMode && status === "live" ? (
              <span className="rounded bg-darla-green/15 px-1.5 py-0.5 text-darla-green">LIVE</span>
            ) : null}
          </div>
        </div>

        <div className="relative mb-3 h-10 shrink-0">
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-darla-border/80" />
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-darla-blue/35 transition-[width] duration-200"
            style={{ width: `${tickPercent(currentTick, maxTick)}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-darla-blue shadow-[0_0_8px_rgba(77,163,255,0.6)] transition-[left] duration-200"
            style={{ left: `${tickPercent(currentTick, maxTick)}%` }}
            title={`Current tick T+${currentTick}`}
          />
          {visibleRailEvents.map((event) => {
            const type = inferEventType(event);
            const isRoutine = isRoutineEvent(event);
            const isActive = event.tick === currentTick || selectedEvent?.event_id === event.event_id;
            return (
              <button
                key={event.event_id}
                type="button"
                onClick={() => handleEventClick(event)}
                className={`absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-transform hover:scale-125 ${
                  isActive
                    ? "h-3.5 w-3.5 border-darla-blue bg-darla-blue"
                    : isRoutine
                      ? "h-1.5 w-1.5 border-darla-border/60 bg-darla-text-muted/30"
                      : "h-2.5 w-2.5 border-darla-panel bg-darla-text-secondary"
                } ${typeColors[type]}`}
                style={{ left: `${tickPercent(event.tick, maxTick)}%` }}
                title={`T+${event.tick} · ${formatEventTitle(event)}`}
              />
            );
          })}
        </div>

        {nearbyEvents.length === 0 ? (
          <div className="rounded-lg border border-darla-border/60 bg-darla-panel/40 px-3 py-3 text-[11px] text-darla-text-muted">
            No mission-critical events yet at T+{currentTick}.
            {routineCount > 0 ? " Co-sim and agent monitoring ticks are hidden by default." : null}
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto lg:grid-cols-3 xl:grid-cols-6">
            {nearbyEvents.map((event) => {
              const type = inferEventType(event);
              const isActive = selectedEvent?.event_id === event.event_id && drawerOpen;
              const delta = event.deltas.find((d) => d.before !== d.after);
              return (
                <button
                  key={event.event_id}
                  type="button"
                  onClick={() => handleEventClick(event)}
                  className={`flex min-w-0 flex-col rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    isActive
                      ? "border-darla-blue bg-darla-blue/10"
                      : event.tick === currentTick
                        ? "border-darla-blue/50 bg-darla-panel"
                        : "border-darla-border bg-darla-panel hover:border-darla-border/80 hover:bg-darla-panel-elevated"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${typeColors[type]}`} />
                    <span className="font-mono text-[10px] text-darla-text-secondary">T+{event.tick}</span>
                  </div>
                  <span className="mt-1 line-clamp-2 text-[11px] leading-snug text-darla-text">
                    {formatEventTitle(event)}
                  </span>
                  {delta ? (
                    <span className="mt-1 line-clamp-1 font-mono text-[9px] text-darla-text-muted">
                      {delta.field.split(".").pop()}: {delta.before} → {delta.after}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <SimEventDrawer
        event={selectedEvent}
        open={drawerOpen && !onOpenCausal}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}

function SimEventDrawer({
  event,
  open,
  onClose,
}: {
  event: SimEvent | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!event) return null;

  return (
    <Drawer open={open} onClose={onClose} title="Event Details" width="lg">
      <div className="space-y-3 text-sm">
        <Field label="Tick" value={`T+${event.tick}`} mono />
        <Field label="Event" value={event.label || event.type} />
        <Field label="Type" value={event.type} />
        <Field label="Provenance" value={event.provenance} />
        <Field label="Confidence" value={`${Math.round(event.confidence * 100)}%`} />
        {event.deltas.length > 0 ? (
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-darla-text-secondary">
              Field deltas
            </div>
            <div className="space-y-1 text-xs text-darla-text-secondary">
              {event.deltas.map((delta) => (
                <div key={delta.field}>
                  {delta.field}: {delta.before} → {delta.after}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-darla-text-secondary">{label}</div>
      <div className={`mt-0.5 text-darla-text ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
