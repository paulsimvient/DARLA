import { useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import PlaybackBar from "../PlaybackBar";
import { useSimulation } from "../context/SimulationContext";
import { useCausalDrilldown } from "../hooks/useCausalDrilldown";
import MapPanel from "../MapPanel";
import { entityIdsForTimelineRangeFromFrames } from "../types/selection";
import { eventsInRange, type TickRange } from "../utils/timelineGroupSelection";

export default function Replay3DPage() {
  const {
    entities,
    relationships,
    events,
    timelineEvents,
    currentTick,
    liveTick,
    timelineMode,
    reviewHold,
    runIdentity,
    playback,
    currentFrame,
    dashboard,
    isPlaying,
    liveMode,
    status,
    setViewTick,
    followLive,
    setTimelineMode,
    setIsPlaying,
    simulateWhatIf,
    continueReview,
  } = useSimulation();

  const { openForEvent, drawer } = useCausalDrilldown();
  const [timelineRange, setTimelineRange] = useState<TickRange | null>(null);
  const [rangeFocusStamp, setRangeFocusStamp] = useState(0);

  const timelineFitIds = useMemo(
    () =>
      entityIdsForTimelineRangeFromFrames(
        events,
        timelineRange,
        entities,
        relationships,
        playback?.frames ?? [],
        dashboard?.coa_log ?? [],
      ),
    [dashboard?.coa_log, entities, events, playback?.frames, relationships, timelineRange],
  );

  const handleTimelineRangeChange = (range: TickRange | null) => {
    setTimelineRange(range);
    setRangeFocusStamp((stamp) => stamp + 1);
  };

  return (
    <AppShell hideStatusBar>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="rounded-lg border border-darla-border bg-darla-panel px-4 py-3">
          <h2 className="text-sm font-semibold text-darla-text">3D Replay — Sim-backed perspective view</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-darla-text-muted">
            Uses the same live playback stream and entity altitudes as the operational map. Pitch and
            bearing show platform height and theater geometry; authoritative state remains in the DARLA
            sim export (replay {dashboard?.replay_hash?.slice(0, 12) ?? "pending"}).
          </p>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-darla-border bg-darla-bg">
          <MapPanel
            entities={entities}
            relationships={relationships}
            currentTick={currentTick}
            liveTick={liveTick}
            timelineMode={timelineMode}
            fitEntityIds={timelineFitIds.length > 0 ? timelineFitIds : null}
            focusStamp={rangeFocusStamp}
            simOverlays={currentFrame?.map_overlays ?? []}
            viewMode="3d"
            showChrome
            className="h-full min-h-[420px]"
          />
        </div>

        {playback ? (
          <PlaybackBar
            playback={playback}
            events={events}
            timelineEvents={timelineEvents}
            coaLog={dashboard?.coa_log}
            missionRisk={currentFrame?.agent_beliefs?.mission_risk ?? 0.5}
            currentTick={currentTick}
            liveTick={liveTick}
            timelineMode={timelineMode}
            reviewHold={reviewHold}
            runIdentity={runIdentity}
            onTickChange={setViewTick}
            onFollowLive={followLive}
            onTimelineModeChange={setTimelineMode}
            onContinueReview={() => void continueReview()}
            isPlaying={isPlaying}
            onPlayingChange={setIsPlaying}
            liveMode={liveMode && status !== "ready"}
            layout="compact-drawer"
            showSelectedMomentPanel
            onCreateBranchFromRange={async (range, coa) => {
              if (coa) await simulateWhatIf(coa, range.start);
            }}
            onOpenGroupCausal={(allEvents, range) => {
              const first = eventsInRange(allEvents, range)[0];
              if (first) openForEvent(first);
            }}
            onRangeChange={handleTimelineRangeChange}
          />
        ) : null}
      </div>
      {drawer}
    </AppShell>
  );
}
