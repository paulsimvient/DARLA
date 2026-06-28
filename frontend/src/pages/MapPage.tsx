import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import AppShell from "../components/AppShell";
import InspectorRail from "../components/InspectorRail";
import { HGroup, RHandle, RPanel, VGroup } from "../components/layout/ResizableLayout";
import ScenarioTree from "../components/ScenarioTree";
import { useSimulation } from "../context/SimulationContext";
import { useCausalDrilldown } from "../hooks/useCausalDrilldown";
import MapPanel, { type MapPanelHandle } from "../MapPanel";
import PlaybackBar from "../PlaybackBar";
import { readPersistedTimelineRange } from "../components/replay/ReplayWorkbench";
import type { TreeSelection } from "../types/selection";
import {
  entityIdsForTimelineRangeFromFrames,
  mapFocusFromSelection,
  resolveMapFitEntityIds,
} from "../types/selection";
import { findCoaById, formatCoaAction } from "../utils/coaHelpers";
import { eventsInRange, type TickRange } from "../utils/timelineGroupSelection";

type MapLocationState = {
  entityId?: string;
  coaId?: number;
  coaAction?: string;
};

export default function MapPage() {
  const {
    currentFrame,
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
    isPlaying,
    liveMode,
    status,
    dashboard,
    setViewTick,
    followLive,
    setTimelineMode,
    setIsPlaying,
    continueReview,
  } = useSimulation();

  const { openForEntityId, openForEvent, drawer } = useCausalDrilldown();
  const location = useLocation();
  const navState = (location.state as MapLocationState | null) ?? null;

  const [selection, setSelection] = useState<TreeSelection>(
    navState?.entityId ? { type: "entity", id: navState.entityId } : { type: "scenario" },
  );
  const [focusStamp, setFocusStamp] = useState(0);
  const mapPanelRef = useRef<MapPanelHandle>(null);
  const [timelineRange, setTimelineRange] = useState<TickRange | null>(() => readPersistedTimelineRange());
  const [rangeFocusStamp, setRangeFocusStamp] = useState(0);
  const [coaOverlay, setCoaOverlay] = useState<MapLocationState | null>(
    navState?.coaId != null ? navState : null,
  );
  const handleSelect = useCallback(
    (next: TreeSelection) => {
      setSelection(next);
      setFocusStamp((stamp) => stamp + 1);
      if (next.type === "event") {
        const event = events.find((entry) => entry.event_id === next.id);
        if (event) setViewTick(event.tick);
      }
      if (next.type === "entity" || next.type === "coa") {
        setCoaOverlay(null);
      }
    },
    [events, setViewTick],
  );
  const handleTimelineRangeChange = useCallback((range: TickRange | null) => {
    setTimelineRange(range);
    if (range) setRangeFocusStamp((stamp) => stamp + 1);
  }, []);

  useEffect(() => {
    if (navState?.entityId) {
      handleSelect({ type: "entity", id: navState.entityId });
    }
    if (navState?.coaId != null) {
      setCoaOverlay(navState);
    }
  }, [handleSelect, location.key, navState]);

  const overlayCoa = useMemo(() => {
    if (coaOverlay?.coaId == null) return null;
    const fromLog = findCoaById(dashboard?.coa_log ?? [], coaOverlay.coaId);
    if (fromLog) {
      return { id: fromLog.id, action: fromLog.action, target: fromLog.target };
    }
    if (coaOverlay.coaAction && coaOverlay.entityId) {
      return {
        id: coaOverlay.coaId,
        action: coaOverlay.coaAction,
        target: coaOverlay.entityId,
      };
    }
    return null;
  }, [coaOverlay, dashboard]);

  const mapFocus = mapFocusFromSelection(
    selection,
    relationships,
    entities,
    events,
    dashboard?.coa_log ?? [],
    currentFrame?.coa_recommendations ?? [],
  );
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
  const fitEntityIds = resolveMapFitEntityIds(mapFocus, timelineRange, timelineFitIds);
  const { selectedEntityId, focusEdge } = mapFocus;

  useEffect(() => {
    if (focusStamp + rangeFocusStamp === 0) return;
    const frame = requestAnimationFrame(() => {
      mapPanelRef.current?.focusCurrentSelection();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusStamp, rangeFocusStamp]);

  return (
    <AppShell>
      <VGroup id="darla-map-outer-v" autoSaveId="darla-map-outer-v" className="min-h-0 flex-1">
        <RPanel defaultSize={58} minSize={28}>
          <HGroup id="darla-map-h" autoSaveId="darla-map-h" className="min-h-0">
            <RPanel defaultSize={18} minSize={12} maxSize={32}>
              <ScenarioTree selection={selection} onSelect={handleSelect} />
            </RPanel>
            <RHandle />
            <RPanel defaultSize={57} minSize={35}>
              <div className="flex h-full min-h-0 flex-col bg-darla-bg p-4 pb-0">
                {overlayCoa ? (
                  <div className="mb-2 flex shrink-0 items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-[11px] text-emerald-100">
                    <span>
                      COA overlay active: {formatCoaAction(overlayCoa.action)} on {overlayCoa.target}
                    </span>
                    <button
                      type="button"
                      className="darla-btn py-1 text-[10px]"
                      onClick={() => setCoaOverlay(null)}
                    >
                      Clear overlay
                    </button>
                  </div>
                ) : null}
                <div className="min-h-0 flex-1">
                  <MapPanel
                    ref={mapPanelRef}
                    entities={entities}
                    relationships={relationships}
                    currentTick={currentTick}
                    liveTick={liveTick}
                    timelineMode={timelineMode}
                    selectedEntityId={selectedEntityId}
                    focusEdge={focusEdge}
                    fitEntityIds={fitEntityIds}
                    focusStamp={focusStamp + rangeFocusStamp}
                    coaOverlay={overlayCoa}
                    simOverlays={currentFrame?.map_overlays ?? []}
                    onSelectEntity={(id) => {
                      if (id) handleSelect({ type: "entity", id });
                    }}
                    onOpenCausalDrilldown={openForEntityId}
                    className="h-full min-h-0"
                  />
                </div>
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
              range={timelineRange}
              onRangeChange={handleTimelineRangeChange}
              selectedEventId={selection.type === "event" ? selection.id : null}
              onEventSelect={(event) => {
                handleSelect({ type: "event", id: event.event_id });
              }}
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
