export type TimelineBackendStatus =
  | "idle"
  | "loading"
  | "running"
  | "complete"
  | "review_hold"
  | "error";

export type TimelinePlayState =
  | "stopped"
  | "playing"
  | "paused"
  | "ended"
  | "buffering"
  | "error";

export type TimelinePauseReason =
  | { kind: "user"; tick: number }
  | { kind: "review_hold"; tick: number; coa_ids: number[] }
  | { kind: "breakpoint"; tick: number; label: string; event_id: number }
  | { kind: "ended"; tick: number }
  | null;

export type TimelineV2State = {
  /** The one and only user-visible playhead. */
  currentTick: number;
  /** Highest tick for which the backend has streamed state/events. */
  availableUntilTick: number;
  /** Scenario/replay horizon. The playhead can keep moving to this tick after backend completion. */
  finalTick: number;
  playState: TimelinePlayState;
  backendStatus: TimelineBackendStatus;
  pauseReason: TimelinePauseReason;
  playbackSpeed: number;
  lastFrameReceivedAt: number | null;
  lastEventLabel: string | null;
  bufferedFrames: number;
  droppedSseBlocks: number;
};

export type TimelineV2Action =
  | { type: "RESET"; finalTick?: number }
  | { type: "SET_FINAL_TICK"; finalTick: number }
  | { type: "FRAME_RECEIVED"; tick: number; receivedAt: number; bufferedFrames: number; lastEventLabel?: string | null }
  | { type: "BACKEND_STATUS"; status: TimelineBackendStatus }
  | { type: "PLAY" }
  | { type: "PAUSE"; reason?: TimelinePauseReason }
  | { type: "SEEK"; tick: number; preservePlayState?: boolean }
  | { type: "TICK"; deltaTicks: number }
  | { type: "REVIEW_HOLD"; tick: number; coa_ids: number[]; pause: boolean }
  | { type: "DONE"; finalTick: number }
  | { type: "ERROR" }
  | { type: "SET_SPEED"; speed: number }
  | { type: "DROPPED_SSE_BLOCK" };

export const initialTimelineV2State: TimelineV2State = {
  currentTick: 0,
  availableUntilTick: 0,
  finalTick: 0,
  playState: "stopped",
  backendStatus: "idle",
  pauseReason: null,
  playbackSpeed: 10,
  lastFrameReceivedAt: null,
  lastEventLabel: null,
  bufferedFrames: 0,
  droppedSseBlocks: 0,
};

export function clampTick(tick: number, finalTick: number): number {
  return Math.max(0, Math.min(Math.floor(tick), Math.max(0, Math.floor(finalTick))));
}
