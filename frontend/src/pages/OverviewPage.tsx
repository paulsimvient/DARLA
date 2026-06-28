import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppShell from "../components/AppShell";
import BranchCompareStrip, { metricsFromFrame } from "../components/coa/BranchCompareStrip";
import BranchDualMap from "../components/coa/BranchDualMap";
import InspectorRail from "../components/InspectorRail";
import ReplayWorkbench, { readPersistedTimelineRange } from "../components/replay/ReplayWorkbench";
import { HGroup, RHandle, RPanel, VGroup } from "../components/layout/ResizableLayout";
import ScenarioTree from "../components/ScenarioTree";
import { useSimulation } from "../context/SimulationContext";
import { useCausalDrilldown } from "../hooks/useCausalDrilldown";
import MapPanel, { type MapPanelHandle } from "../MapPanel";
import type { TreeSelection } from "../types/selection";
import {
  entityIdsForTimelineRangeFromFrames,
  mapFocusFromSelection,
  resolveMapFitEntityIds,
} from "../types/selection";
import { eventsInRange, type TickRange } from "../utils/timelineGroupSelection";

export default function OverviewPage() {
  const {
    entities,
    branchEntities,
    displayEntities,
    relationships,
    currentTick,
    currentFrame,
    displayCurrentFrame,
    compareBranchFrame,
    events,
    timelineEvents,
    playback,
    displayPlayback,
    isPlaying,
    liveMode,
    status,
    replayView,
    compareBranch,
    runIdentity,
    dashboard,
    setViewTick,
    followLive,
    liveTick,
    timelineMode,
    setTimelineMode,
    reviewHold,
    setIsPlaying,
    stopBranchCompare,
    continueReview,
  } = useSimulation();

  const { openForEntityId, openForEvent, drawer } = useCausalDrilldown();
  const [selection, setSelection] = useState<TreeSelection>({ type: "scenario" });
  const [focusStamp, setFocusStamp] = useState(0);
  const mapPanelRef = useRef<MapPanelHandle>(null);
  const [timelineRange, setTimelineRange] = useState<TickRange | null>(() => readPersistedTimelineRange());
  const [rangeFocusStamp, setRangeFocusStamp] = useState(0);
  const handleSelect = useCallback(
    (next: TreeSelection) => {
      setSelection(next);
      setFocusStamp((stamp) => stamp + 1);
      if (next.type === "event") {
        const event = events.find((entry) => entry.event_id === next.id);
        if (event) setViewTick(event.tick);
      }
    },
    [events, setViewTick],
  );
  const handleTimelineRangeChange = useCallback((range: TickRange | null) => {
    setTimelineRange(range);
    if (range) setRangeFocusStamp((stamp) => stamp + 1);
  }, []);
  const mapEntities = replayView === "branch" ? displayEntities : entities;
  const mapFrame = replayView === "branch" ? displayCurrentFrame : currentFrame;
  const activePlayback = displayPlayback ?? playback;
  const mapFocus = mapFocusFromSelection(
    selection,
    relationships,
    mapEntities,
    events,
    dashboard?.coa_log ?? [],
    currentFrame?.coa_recommendations ?? [],
  );
  const timelineFitIds = useMemo(
    () =>
      entityIdsForTimelineRangeFromFrames(
        events,
        timelineRange,
        mapEntities,
        relationships,
        activePlayback?.frames ?? [],
        dashboard?.coa_log ?? [],
      ),
    [activePlayback?.frames, dashboard?.coa_log, events, mapEntities, relationships, timelineRange],
  );
  const fitEntityIds = resolveMapFitEntityIds(mapFocus, timelineRange, timelineFitIds);
  const { selectedEntityId, focusEdge } = mapFocus;
  const showDualMap = replayView === "compare" && compareBranch != null;

  useEffect(() => {
    if (focusStamp + rangeFocusStamp === 0) return;
    const frame = requestAnimationFrame(() => {
      mapPanelRef.current?.focusCurrentSelection();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusStamp, rangeFocusStamp]);

  return (
    <AppShell>
      <VGroup id="darla-overview-outer-v" autoSaveId="darla-overview-outer-v" className="min-h-0 flex-1">
        <RPanel defaultSize={58} minSize={28}>
          <HGroup id="darla-overview-h" autoSaveId="darla-overview-h" className="min-h-0">
            <RPanel defaultSize={18} minSize={12} maxSize={32}>
              <ScenarioTree selection={selection} onSelect={handleSelect} />
            </RPanel>
            <RHandle />
            <RPanel defaultSize={57} minSize={35}>
              <div className="flex h-full min-h-0 flex-col gap-2 p-3 pb-0">
                {showDualMap ? (
                  <BranchDualMap
                    tick={currentTick}
                    baselineEntities={entities}
                    branchEntities={branchEntities}
                    relationships={relationships}
                    baselineLabel={runIdentity?.branch_id ?? "baseline"}
                    branchLabel={compareBranch.branch_id}
                  />
                ) : (
                  <MapPanel
                    ref={mapPanelRef}
                    className="h-full min-h-0"
                    entities={mapEntities}
                    relationships={relationships}
                    currentTick={currentTick}
                    liveTick={liveTick}
                    timelineMode={timelineMode}
                    selectedEntityId={selectedEntityId}
                    focusEdge={focusEdge}
                    fitEntityIds={fitEntityIds}
                    focusStamp={focusStamp + rangeFocusStamp}
                    simOverlays={mapFrame?.map_overlays ?? []}
                    onSelectEntity={(id) => {
                      if (id) handleSelect({ type: "entity", id });
                    }}
                    onOpenCausalDrilldown={openForEntityId}
                  />
                )}
                {showDualMap ? (
                  <div className="shrink-0">
                    <BranchCompareStrip
                      tick={currentTick}
                      baselineLabel={runIdentity?.branch_id ?? "baseline"}
                      branchLabel={compareBranch.branch_id}
                      baselineMetrics={metricsFromFrame(currentFrame)}
                      branchMetrics={metricsFromFrame(compareBranchFrame)}
                      branchResult={compareBranch}
                    />
                    <button
                      type="button"
                      className="darla-btn mt-2 py-1 text-[10px]"
                      onClick={stopBranchCompare}
                    >
                      Exit compare mode
                    </button>
                  </div>
                ) : null}
              </div>
            </RPanel>
            <RHandle />
            <RPanel defaultSize={25} minSize={16} maxSize={42}>
              <InspectorRail
                selection={selection}
                onSelect={handleSelect}
                timelineRange={timelineRange}
                onOpenEventCausal={openForEvent}
                onOpenMomentCausal={() => {
                  if (!timelineRange) return;
                  const first = eventsInRange(timelineEvents, timelineRange)[0];
                  if (first) openForEvent(first);
                }}
              />
            </RPanel>
          </HGroup>
        </RPanel>
        <RHandle />
        <RPanel defaultSize={42} minSize={22}>
          {(displayPlayback ?? playback) ? (
            <ReplayWorkbench
              layout="full"
              playback={(displayPlayback ?? playback)!}
              events={events}
              timelineEvents={timelineEvents}
              coaLog={dashboard?.coa_log}
              missionRisk={currentFrame?.agent_beliefs?.mission_risk ?? 0.5}
              currentTick={currentTick}
              liveTick={liveTick}
              timelineMode={timelineMode}
              reviewHold={reviewHold}
              runIdentity={runIdentity}
              selectedEventId={selection.type === "event" ? selection.id : null}
              range={timelineRange}
              onTickChange={setViewTick}
              onFollowLive={followLive}
              onTimelineModeChange={setTimelineMode}
              onContinueReview={() => void continueReview()}
              onEventSelect={(event) => {
                handleSelect({ type: "event", id: event.event_id });
              }}
              onRangeChange={handleTimelineRangeChange}
              isPlaying={isPlaying}
              onPlayingChange={setIsPlaying}
              liveMode={liveMode && status !== "ready" && replayView === "baseline"}
              replayViewLabel={
                replayView === "branch"
                  ? "branch replay"
                  : replayView === "compare"
                    ? "compare sync"
                    : undefined
              }
              onOpenGroupCausal={(_, range) => {
                const first = eventsInRange(timelineEvents, range)[0];
                if (first) openForEvent(first);
              }}
            />
          ) : null}
        </RPanel>
      </VGroup>
      {drawer}
    </AppShell>
  );
}
