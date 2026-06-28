import { useMemo } from "react";
import type { PlaybackData } from "../../playback";
import { tickPercent } from "../../utils/keyEvents";
import { EVENT_LANES, eventsForLane, inferEventLane, laneMeta, type EventLane } from "../../utils/eventCategories";
import type { SimEvent } from "../../types";
import { formatEventTitle } from "../../utils/keyEvents";

type ReplayTimelineProps = {
  playback: PlaybackData;
  events: SimEvent[];
  currentTick: number;
  selectedEventId?: number | null;
  onTickChange: (tick: number) => void;
  onEventSelect: (event: SimEvent) => void;
  onPlayingChange?: (playing: boolean) => void;
  liveMode?: boolean;
};

export default function ReplayTimeline({
  playback,
  events,
  currentTick,
  selectedEventId,
  onTickChange,
  onEventSelect,
  onPlayingChange,
  liveMode = false,
}: ReplayTimelineProps) {
  const maxTick = playback.final_tick;
  const cutoffPercent = tickPercent(playback.mission_cutoff, maxTick);
  const progressPercent = tickPercent(currentTick, maxTick);

  const laneEvents = useMemo(() => {
    const map = new Map<EventLane, SimEvent[]>();
    for (const lane of EVENT_LANES) {
      map.set(lane.id, eventsForLane(events, lane.id));
    }
    return map;
  }, [events]);

  const pastCutoff = currentTick >= playback.mission_cutoff;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-darla-text-secondary">
            Simulation Timeline
          </h2>
          <p className="mt-0.5 text-[10px] text-darla-text-muted">
            One scrubber · category lanes · click an event to seek and inspect
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <span className="rounded border border-darla-blue/40 bg-darla-blue/10 px-2 py-0.5 font-mono text-darla-blue">
            T+{currentTick}
          </span>
          <span className="font-mono text-darla-text-muted">/ T+{maxTick}</span>
          {pastCutoff ? (
            <span
              className="rounded border border-amber-500/40 bg-amber-950/50 px-2 py-0.5 text-amber-300"
              title="Approvals after this point create a what-if branch"
            >
              Decision cutoff passed · new action creates branch
            </span>
          ) : (
            <span className="rounded border border-darla-border/60 px-2 py-0.5 text-darla-text-muted">
              Cutoff T+{playback.mission_cutoff}
            </span>
          )}
          {liveMode ? (
            <span className="rounded bg-emerald-950/60 px-1.5 py-0.5 text-emerald-400">LIVE</span>
          ) : null}
        </div>
      </div>

      <div className="relative rounded-lg border border-darla-border/80 bg-darla-panel/30 px-3 py-2">
        {EVENT_LANES.map((lane) => {
          const items = laneEvents.get(lane.id) ?? [];
          return (
            <div key={lane.id} className="relative flex h-6 items-center">
              <span className="w-16 shrink-0 text-[9px] uppercase tracking-wide text-darla-text-muted">
                {lane.label}
              </span>
              <div className="relative min-w-0 flex-1">
                <div className={`absolute inset-x-0 top-1/2 h-px -translate-y-1/2 ${lane.lineClass}`} />
                {items.map((event) => {
                  const left = tickPercent(event.tick, maxTick);
                  const active = event.event_id === selectedEventId || event.tick === currentTick;
                  return (
                    <button
                      key={event.event_id}
                      type="button"
                      className={`absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-transform hover:scale-125 ${
                        active
                          ? `h-3 w-3 border-white ${lane.dotClass} ring-2 ring-darla-blue/60`
                          : `h-2 w-2 border-darla-panel/80 ${lane.dotClass}`
                      }`}
                      style={{ left: `${left}%` }}
                      title={`T+${event.tick} · ${formatEventTitle(event)}`}
                      onClick={() => {
                        onPlayingChange?.(false);
                        onTickChange(event.tick);
                        onEventSelect(event);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="relative mt-1 flex h-7 items-center border-t border-darla-border/50 pt-1">
          <span className="w-16 shrink-0 text-[9px] uppercase tracking-wide text-darla-text-muted">Playback</span>
          <div className="relative min-w-0 flex-1">
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-darla-border/80" />
            <div
              className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-darla-blue/50 transition-[width] duration-150"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className="absolute top-0 bottom-0 w-px bg-amber-400/90"
              style={{ left: `${cutoffPercent}%` }}
              title={`Mission cutoff T+${playback.mission_cutoff}`}
            />
            <div
              className="absolute top-1/2 z-20 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-darla-blue shadow-[0_0_10px_rgba(77,163,255,0.55)]"
              style={{ left: `${progressPercent}%` }}
              title={`Current tick T+${currentTick}`}
            />
          </div>
        </div>
      </div>

      <input
        type="range"
        className="w-full accent-darla-blue"
        min={0}
        max={maxTick}
        value={currentTick}
        aria-label="Simulation playback position"
        onChange={(e) => {
          onPlayingChange?.(false);
          onTickChange(Number(e.target.value));
        }}
      />

      <div className="flex flex-wrap gap-3 text-[9px] text-darla-text-muted">
        {EVENT_LANES.map((lane) => (
          <span key={lane.id} className="inline-flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${lane.dotClass}`} />
            {lane.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-px bg-amber-400" />
          Cutoff
        </span>
      </div>
    </div>
  );
}

export function laneLabelForEvent(event: SimEvent): string {
  return laneMeta(inferEventLane(event)).label;
}
