import { useState } from "react";
import TimeGroupActions from "./TimeGroupActions";
import { useSimulation } from "../../context/SimulationContext";
import { useTimelineMoment } from "../../hooks/useTimelineMoment";
import { buildMomentPacket, downloadMomentPacket } from "../../utils/captureMoment";
import { formatSimTimeRange } from "../../utils/simTime";
import { isRangeActive, type TickRange } from "../../utils/timelineGroupSelection";

type SelectedMomentPanelProps = {
  timelineRange?: TickRange | null;
  onOpenGroupCausal?: () => void;
};

export default function SelectedMomentPanel({
  timelineRange = null,
  onOpenGroupCausal,
}: SelectedMomentPanelProps) {
  const {
    dashboard,
    events,
    playback,
    displayPlayback,
    simulateWhatIf,
    liveTick,
    timelineMode,
    reviewHold,
    runIdentity,
    followLive,
    continueReview,
    currentFrame,
  } = useSimulation();
  const activePlayback = displayPlayback ?? playback;
  const tickSeconds = activePlayback?.tick_seconds ?? playback?.tick_seconds ?? 1;
  const missionRisk = currentFrame?.agent_beliefs?.mission_risk ?? 0.5;
  const { summary, bestCoa } = useTimelineMoment({
    playback: activePlayback,
    events,
    coaLog: dashboard?.coa_log,
    missionRisk,
    range: timelineRange,
  });
  const [branchBusy, setBranchBusy] = useState(false);
  const momentActive = isRangeActive(timelineRange);

  const handleCreateBranch = async () => {
    if (!momentActive || !timelineRange) return;
    setBranchBusy(true);
    try {
      if (bestCoa) {
        await simulateWhatIf(bestCoa, timelineRange.start);
      }
    } finally {
      setBranchBusy(false);
    }
  };

  const handleCaptureMoment = () => {
    if (!momentActive || !timelineRange || !activePlayback) return;
    const packet = buildMomentPacket({
      range: timelineRange,
      events,
      frames: activePlayback.frames,
      playback: activePlayback,
      runIdentity,
    });
    downloadMomentPacket(packet);
  };

  const handleOpenGroupCausal = () => {
    if (!momentActive || !timelineRange) return;
    onOpenGroupCausal?.();
  };

  if (!activePlayback) {
    return (
      <aside className="flex h-full w-full flex-col border-l border-darla-border bg-darla-surface">
        <header className="border-b border-darla-border px-4 py-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-darla-text-muted">
            Selected moment
          </h2>
        </header>
        <p className="p-4 text-xs text-darla-text-muted">Waiting for playback…</p>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-full min-h-0 flex-col overflow-hidden border-b border-darla-border bg-darla-surface">
      <header className="shrink-0 border-b border-darla-border px-4 py-2.5">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-darla-text-muted">
          Selected moment
        </h2>
        <p className="mt-1 text-sm font-semibold text-darla-text">
          {momentActive
            ? formatSimTimeRange(timelineRange.start, timelineRange.end, tickSeconds, true)
            : "No window selected"}
        </p>
        <p className="text-[11px] text-darla-text-muted">
          {momentActive
            ? `${summary.eventCount} events · ${summary.modeLabel}`
            : "Drag a window on the timeline or click an event"}
        </p>
      </header>
      <div className="darla-scroll min-h-0 flex-1 overflow-y-auto">
        <TimeGroupActions
          embedded
          events={events}
          range={timelineRange}
          summary={summary}
          tickSeconds={tickSeconds}
          bestCoa={bestCoa}
          timelineMode={timelineMode}
          liveTick={liveTick}
          reviewHold={reviewHold}
          busy={branchBusy}
          onCreateBranch={handleCreateBranch}
          onOpenGroupCausal={handleOpenGroupCausal}
          onCaptureMoment={handleCaptureMoment}
          onFollowLive={followLive}
          onContinueReview={() => void continueReview()}
        />
      </div>
    </aside>
  );
}
