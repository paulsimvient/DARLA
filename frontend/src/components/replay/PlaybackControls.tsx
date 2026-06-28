import { useCallback, useEffect } from "react";
import { Pause, Play, RotateCcw, Radio } from "lucide-react";
import type { PlaybackData } from "../../playback";
import { frameAtTick } from "../../playback";
import { useSimulation } from "../../context/SimulationContext";

const SPEEDS = [1, 5, 10, 30, 100];

type PlaybackControlsProps = {
  playback: PlaybackData;
  currentTick: number;
  liveTick?: number;
  timelineMode?: "follow" | "inspect";
  onTickChange: (tick: number) => void;
  isPlaying: boolean;
  onPlayingChange: (playing: boolean) => void;
  onFollowLive?: () => void;
  onTimelineModeChange?: (mode: "follow" | "inspect") => void;
  liveMode?: boolean;
  replayViewLabel?: string;
  groupFooterStatus?: string;
};

export default function PlaybackControls({
  playback,
  currentTick,
  liveTick = currentTick,
  timelineMode = "follow",
  onTickChange,
  isPlaying,
  onPlayingChange,
  onFollowLive,
  onTimelineModeChange,
  liveMode = false,
  replayViewLabel,
  groupFooterStatus,
}: PlaybackControlsProps) {
  const { playbackSpeed, setPlaybackSpeed } = useSimulation();
  const followActive = liveMode && timelineMode === "follow";

  const pauseLiveFollow = useCallback(() => {
    onTimelineModeChange?.("inspect");
    onPlayingChange(false);
  }, [onPlayingChange, onTimelineModeChange]);

  const resumeLiveFollow = useCallback(() => {
    onFollowLive?.();
  }, [onFollowLive]);

  const togglePlayback = useCallback(() => {
    if (liveMode) {
      if (followActive) {
        pauseLiveFollow();
      } else {
        resumeLiveFollow();
      }
      return;
    }
    onPlayingChange(!isPlaying);
  }, [followActive, isPlaying, liveMode, onPlayingChange, pauseLiveFollow, resumeLiveFollow]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.key !== " ") return;
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      togglePlayback();
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [togglePlayback]);

  const frame = frameAtTick(playback.frames, currentTick);
  const pastCutoff = currentTick >= playback.mission_cutoff;
  const canFollowLive = liveMode && timelineMode === "inspect" && onFollowLive && liveTick > currentTick;

  if (!frame) {
    return (
      <div className="border-t border-darla-border bg-darla-surface px-4 py-2 text-xs text-darla-text-muted">
        Waiting for simulation frames…
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-darla-border bg-darla-surface px-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="darla-btn" onClick={togglePlayback}>
          {followActive ? <Pause size={14} /> : <Play size={14} />}
          {followActive ? "Pause follow" : liveMode ? "Follow live" : "Play"}
        </button>
        {canFollowLive ? (
          <button type="button" className="darla-btn darla-btn-primary" onClick={onFollowLive}>
            <Radio size={14} />
            Follow Live T+{liveTick}
          </button>
        ) : null}
        <button
          type="button"
          className="darla-btn"
          onClick={() => {
            onPlayingChange(false);
            onTickChange(0);
          }}
        >
          <RotateCcw size={14} />
          Reset
        </button>
        <label className="flex items-center gap-2 text-[11px] text-darla-text-muted">
          Speed
          <select
            className="darla-select py-1"
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
          >
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
        {replayViewLabel ? (
          <span className="rounded bg-violet-950/60 px-1.5 py-0.5 text-[10px] text-violet-300">
            {replayViewLabel}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        {groupFooterStatus ? (
          <span className="font-mono text-darla-text-muted">{groupFooterStatus}</span>
        ) : pastCutoff ? (
          <span className="max-w-xs text-amber-300/90">
            Past execution window — branching creates what-if, not baseline history
          </span>
        ) : null}
        <span className="font-mono text-darla-text-secondary">
          score {frame.metrics.mission_success_score.toFixed(2)}
          {frame.metrics.target_detected
            ? ` · detected T+${frame.metrics.detection_time}`
            : " · not detected"}
          {frame.agent_beliefs
            ? ` · risk ${frame.agent_beliefs.mission_risk.toFixed(2)} · trust ${frame.agent_beliefs.sensor_trust.toFixed(2)}`
            : ""}
        </span>
      </div>
    </div>
  );
}
