import type { CourseOfAction, RunIdentity, SimEvent } from "./types";
import type { PlaybackData } from "./playback";
import type { TickRange } from "./utils/timelineGroupSelection";
import ReplayWorkbench from "./components/replay/ReplayWorkbench";

interface Props {
  playback: PlaybackData;
  events?: SimEvent[];
  timelineEvents?: SimEvent[];
  coaLog?: CourseOfAction[];
  missionRisk?: number;
  currentTick: number;
  liveTick?: number;
  timelineMode?: "follow" | "inspect";
  reviewHold?: { tick: number; coa_ids: number[] } | null;
  runIdentity?: RunIdentity | null;
  onTickChange: (tick: number) => void;
  onFollowLive?: () => void;
  onTimelineModeChange?: (mode: "follow" | "inspect") => void;
  onContinueReview?: () => void;
  isPlaying: boolean;
  onPlayingChange: (playing: boolean) => void;
  liveMode?: boolean;
  replayViewLabel?: string;
  layout?: "full" | "compact" | "compact-drawer";
  showSelectedMomentPanel?: boolean;
  selectedEventId?: number | null;
  onEventSelect?: (event: SimEvent) => void;
  onCreateBranchFromRange?: (range: TickRange, coa: CourseOfAction | null) => Promise<void>;
  onOpenGroupCausal?: (events: SimEvent[], range: TickRange) => void;
  onRangeChange?: (range: TickRange | null) => void;
  range?: TickRange | null;
}

export default function PlaybackBar({
  playback,
  events = [],
  timelineEvents,
  currentTick,
  liveTick,
  timelineMode,
  reviewHold,
  runIdentity,
  onTickChange,
  onFollowLive,
  onTimelineModeChange,
  onContinueReview,
  isPlaying,
  onPlayingChange,
  liveMode = false,
  replayViewLabel,
  layout = "compact-drawer",
  showSelectedMomentPanel = false,
  selectedEventId = null,
  onEventSelect = () => {},
  coaLog,
  missionRisk,
  onCreateBranchFromRange,
  onOpenGroupCausal,
  onRangeChange,
  range,
}: Props) {
  return (
    <ReplayWorkbench
      playback={playback}
      events={events}
      timelineEvents={timelineEvents}
      coaLog={coaLog}
      missionRisk={missionRisk}
      currentTick={currentTick}
      liveTick={liveTick}
      timelineMode={timelineMode}
      reviewHold={reviewHold}
      runIdentity={runIdentity}
      selectedEventId={selectedEventId}
      onTickChange={onTickChange}
      onEventSelect={onEventSelect}
      isPlaying={isPlaying}
      onPlayingChange={onPlayingChange}
      onFollowLive={onFollowLive}
      onTimelineModeChange={onTimelineModeChange}
      onContinueReview={onContinueReview}
      liveMode={liveMode}
      replayViewLabel={replayViewLabel}
      layout={layout}
      showSelectedMomentPanel={showSelectedMomentPanel}
      onCreateBranchFromRange={onCreateBranchFromRange}
      onOpenGroupCausal={onOpenGroupCausal}
      onRangeChange={onRangeChange}
      range={range}
    />
  );
}
