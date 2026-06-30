import { useCallback, useEffect, useState } from "react";
import type { PlaybackData } from "../../playback";
import type { CourseOfAction, RunIdentity, SimEvent } from "../../types";
import { buildMomentPacket, downloadMomentPacket } from "../../utils/captureMoment";
import { useTimelineMoment } from "../../hooks/useTimelineMoment";
import {
  defaultGroupRange,
  isRangeActive,
  normalizeRange,
  rangeAroundTick,
  type TickRange,
} from "../../utils/timelineGroupSelection";
import GroupSummary from "./GroupSummary";
import { HGroup, RHandle, RPanel, VGroup } from "../layout/ResizableLayout";
import PlaybackControls from "./PlaybackControls";
import RecentActivityPanel from "./RecentActivityPanel";
import TimeGroupActions from "./TimeGroupActions";
import TimeGroupTimeline from "./TimeGroupTimeline";

const RANGE_STORAGE_KEY = "darla.timeline.range";

type ReplayWorkbenchProps = {
  playback: PlaybackData;
  events: SimEvent[];
  timelineEvents?: SimEvent[];
  coaLog?: CourseOfAction[];
  missionRisk?: number;
  currentTick: number;
  liveTick?: number;
  timelineMode?: "follow" | "inspect";
  reviewHold?: { tick: number; coa_ids: number[] } | null;
  runIdentity?: RunIdentity | null;
  selectedEventId?: number | null;
  onTickChange: (tick: number) => void;
  onEventSelect: (event: SimEvent) => void;
  isPlaying: boolean;
  onPlayingChange: (playing: boolean) => void;
  onFollowLive?: () => void;
  onTimelineModeChange?: (mode: "follow" | "inspect") => void;
  onContinueReview?: () => void;
  liveMode?: boolean;
  replayViewLabel?: string;
  layout?: "full" | "compact" | "compact-drawer";
  showSelectedMomentPanel?: boolean;
  onCreateBranchFromRange?: (range: TickRange, coa: CourseOfAction | null) => Promise<void>;
  onOpenGroupCausal?: (events: SimEvent[], range: TickRange) => void;
  onRangeChange?: (range: TickRange | null) => void;
  range?: TickRange | null;
};

export function readPersistedTimelineRange(): TickRange | null {
  try {
    const raw = sessionStorage.getItem(RANGE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TickRange;
    if (typeof parsed.start === "number" && typeof parsed.end === "number") return parsed;
  } catch {
    // ignore
  }
  return null;
}

export default function ReplayWorkbench({
  playback,
  events,
  timelineEvents: timelineEventsProp,
  coaLog,
  missionRisk = 0.5,
  currentTick,
  liveTick = 0,
  timelineMode = "follow",
  reviewHold = null,
  runIdentity = null,
  selectedEventId,
  onTickChange,
  onEventSelect,
  isPlaying,
  onPlayingChange,
  onFollowLive,
  onTimelineModeChange,
  onContinueReview,
  liveMode = false,
  replayViewLabel,
  layout = "full",
  showSelectedMomentPanel = false,
  onCreateBranchFromRange,
  onOpenGroupCausal,
  onRangeChange,
  range: controlledRange,
}: ReplayWorkbenchProps) {
  const [internalRange, setInternalRange] = useState<TickRange | null>(() => readPersistedTimelineRange());
  const rangeControlled = controlledRange !== undefined;
  const range = rangeControlled ? controlledRange : internalRange;
  const [branchBusy, setBranchBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const timelineEvents = timelineEventsProp ?? events;

  const { summary, bestCoa } = useTimelineMoment({
    playback,
    events,
    coaLog,
    missionRisk,
    range,
  });

  useEffect(() => {
    setInternalRange((prev) => (prev ? normalizeRange(prev.start, prev.end, playback.final_tick) : null));
  }, [playback.final_tick]);

  useEffect(() => {
    if (rangeControlled) return;
    if (range) {
      sessionStorage.setItem(RANGE_STORAGE_KEY, JSON.stringify(range));
    } else {
      sessionStorage.removeItem(RANGE_STORAGE_KEY);
    }
  }, [range, rangeControlled]);

  useEffect(() => {
    if (!rangeControlled) return;
    if (controlledRange) {
      sessionStorage.setItem(RANGE_STORAGE_KEY, JSON.stringify(controlledRange));
    } else {
      sessionStorage.removeItem(RANGE_STORAGE_KEY);
    }
  }, [controlledRange, rangeControlled]);

  const handleRangeChange = useCallback(
    (next: TickRange | null) => {
      if (!rangeControlled) setInternalRange(next);
      onRangeChange?.(next);
    },
    [onRangeChange, rangeControlled],
  );

  useEffect(() => {
    if (range || events.length === 0 || timelineMode !== "inspect") return;
    const next = defaultGroupRange(events, currentTick, playback.final_tick);
    if (next) handleRangeChange(next);
  }, [currentTick, events, handleRangeChange, playback.final_tick, range, timelineMode]);

  useEffect(() => {
    if (!rangeControlled || !controlledRange) return;
    const normalized = normalizeRange(
      controlledRange.start,
      controlledRange.end,
      playback.final_tick,
    );
    if (normalized == null) {
      onRangeChange?.(null);
      return;
    }
    if (normalized.start !== controlledRange.start || normalized.end !== controlledRange.end) {
      onRangeChange?.(normalized);
    }
  }, [controlledRange, onRangeChange, playback.final_tick, rangeControlled]);

  const handleEventSelect = useCallback(
    (event: SimEvent) => {
      onTickChange(event.tick);
      onEventSelect(event);
      handleRangeChange(rangeAroundTick(event.tick, playback.final_tick));
    },
    [handleRangeChange, onEventSelect, onTickChange, playback.final_tick],
  );

  const handleCreateBranch = async () => {
    if (!onCreateBranchFromRange || !isRangeActive(range)) return;
    setBranchBusy(true);
    try {
      await onCreateBranchFromRange(range, bestCoa);
    } finally {
      setBranchBusy(false);
    }
  };

  const handleCaptureMoment = () => {
    if (!isRangeActive(range)) return;
    const packet = buildMomentPacket({
      range,
      events,
      frames: playback.frames,
      playback,
      runIdentity,
    });
    downloadMomentPacket(packet);
  };

  const selectedMomentPanel = showSelectedMomentPanel ? (
    <>
      <RHandle />
      <RPanel defaultSize={32} minSize={16} maxSize={48}>
        <div className="h-full min-h-0 overflow-hidden pl-1">
          <TimeGroupActions
            events={events}
            range={range}
            summary={summary}
            tickSeconds={playback.tick_seconds ?? 1}
            bestCoa={bestCoa}
            timelineMode={timelineMode}
            liveTick={liveTick}
            reviewHold={reviewHold}
            busy={branchBusy}
            onCreateBranch={onCreateBranchFromRange ? handleCreateBranch : undefined}
            onOpenGroupCausal={
              onOpenGroupCausal
                ? () => {
                    if (isRangeActive(range)) onOpenGroupCausal(events, range);
                  }
                : undefined
            }
            onCaptureMoment={handleCaptureMoment}
            onFollowLive={onFollowLive}
            onContinueReview={onContinueReview}
          />
        </div>
      </RPanel>
    </>
  ) : null;

  const momentPanels = (
    <HGroup
      id="darla-replay-moment-columns"
      autoSaveId="darla-replay-moment-columns"
      className="h-full min-h-0 gap-1"
    >
      <RPanel
        defaultSize={showSelectedMomentPanel ? 22 : 30}
        minSize={12}
        maxSize={showSelectedMomentPanel ? 42 : 48}
      >
        <div className="h-full min-h-0 overflow-hidden">
          <RecentActivityPanel
            events={events}
            range={range}
            tickSeconds={playback.tick_seconds ?? 1}
            selectedEventId={selectedEventId}
            onSelect={handleEventSelect}
          />
        </div>
      </RPanel>
      <RHandle />
      <RPanel defaultSize={showSelectedMomentPanel ? 46 : 70} minSize={20}>
        <div className="h-full min-h-0 overflow-hidden">
          <GroupSummary summary={summary} tickSeconds={playback.tick_seconds ?? 1} />
        </div>
      </RPanel>
      {selectedMomentPanel}
    </HGroup>
  );

  const timeline = (
    <TimeGroupTimeline
      playback={playback}
      events={timelineEvents}
      currentTick={currentTick}
      liveTick={liveTick}
      timelineMode={timelineMode}
      range={range}
      onRangeChange={handleRangeChange}
      selectedEventId={selectedEventId}
      onTickChange={onTickChange}
      onEventSelect={handleEventSelect}
      onTimelineModeChange={onTimelineModeChange}
      liveMode={liveMode}
      rangeModeLabel={summary.modeLabel}
      selectedEventCount={summary.eventCount}
    />
  );

  const controls = (
    <PlaybackControls
      playback={playback}
      currentTick={currentTick}
      liveTick={liveTick}
      timelineMode={timelineMode}
      onTickChange={onTickChange}
      isPlaying={isPlaying}
      onPlayingChange={onPlayingChange}
      onFollowLive={onFollowLive}
      onTimelineModeChange={onTimelineModeChange}
      liveMode={liveMode}
      replayViewLabel={replayViewLabel}
      groupFooterStatus={summary.footerStatus}
    />
  );

  if (layout === "compact") {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden border-t border-darla-border bg-darla-bg">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-darla-border bg-[#0c0f16]/90 px-4 py-3">
          {timeline}
        </div>
        <div className="shrink-0">{controls}</div>
      </div>
    );
  }

  if (layout === "compact-drawer") {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden border-t border-darla-border bg-darla-bg">
        <VGroup id="darla-replay-drawer-v" autoSaveId="darla-replay-drawer-v" className="min-h-0 flex-1">
          <RPanel defaultSize={46} minSize={24} maxSize={72}>
            <div className="flex h-full min-h-0 flex-col overflow-hidden border-b border-darla-border bg-[#0c0f16]/90 px-2 py-2 sm:px-3">
              {timeline}
            </div>
          </RPanel>
          <RHandle />
          <RPanel defaultSize={54} minSize={20}>
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <div className="shrink-0 border-b border-darla-border px-3 py-2">
                <button
                  type="button"
                  className="darla-btn w-full justify-between py-1.5 text-[11px]"
                  onClick={() => setDrawerOpen((open) => !open)}
                >
                  <span>Moment capture · {summary.eventCount} events in selection</span>
                  <span>{drawerOpen ? "Hide" : "Show"}</span>
                </button>
              </div>
              {drawerOpen ? (
                <div className="min-h-0 flex-1 overflow-hidden p-3">{momentPanels}</div>
              ) : null}
            </div>
          </RPanel>
        </VGroup>
        <div className="shrink-0">{controls}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-t border-darla-border bg-darla-bg">
      <VGroup id="darla-replay-workbench-v" autoSaveId="darla-replay-workbench-v" className="min-h-0 flex-1">
        <RPanel defaultSize={40} minSize={22} maxSize={70}>
          <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0c0f16]/90 px-2 py-2 sm:px-3">
            {timeline}
          </div>
        </RPanel>
        <RHandle />
        <RPanel defaultSize={60} minSize={30}>
          <div className="h-full min-h-0 overflow-hidden px-2 pb-2 sm:px-3">{momentPanels}</div>
        </RPanel>
      </VGroup>

      <div className="shrink-0">{controls}</div>
    </div>
  );
}
