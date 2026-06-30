import {
  clampTick,
  initialTimelineV2State,
  type TimelineV2Action,
  type TimelineV2State,
} from "./timelineTypes";

export function timelineV2Reducer(
  state: TimelineV2State,
  action: TimelineV2Action,
): TimelineV2State {
  switch (action.type) {
    case "RESET":
      return {
        ...initialTimelineV2State,
        finalTick: action.finalTick ?? 0,
      };

    case "SET_FINAL_TICK":
      return {
        ...state,
        finalTick: Math.max(state.finalTick, action.finalTick),
        currentTick: clampTick(state.currentTick, Math.max(state.finalTick, action.finalTick)),
      };

    case "FRAME_RECEIVED":
      return {
        ...state,
        backendStatus: state.backendStatus === "idle" || state.backendStatus === "loading" ? "running" : state.backendStatus,
        availableUntilTick: Math.max(state.availableUntilTick, action.tick),
        finalTick: Math.max(state.finalTick, action.tick),
        lastFrameReceivedAt: action.receivedAt,
        bufferedFrames: action.bufferedFrames,
        lastEventLabel: action.lastEventLabel ?? state.lastEventLabel,
      };

    case "BACKEND_STATUS":
      return { ...state, backendStatus: action.status };

    case "PLAY": {
      const shouldRestart = state.finalTick > 0 && state.currentTick >= state.finalTick;
      return {
        ...state,
        currentTick: shouldRestart ? 0 : state.currentTick,
        playState: state.finalTick <= 0 ? "buffering" : "playing",
        pauseReason: null,
      };
    }

    case "PAUSE":
      return {
        ...state,
        playState: "paused",
        pauseReason: action.reason ?? { kind: "user", tick: state.currentTick },
      };

    case "SEEK": {
      const currentTick = clampTick(action.tick, state.finalTick);
      return {
        ...state,
        currentTick,
        pauseReason:
          action.preservePlayState && state.playState === "playing"
            ? null
            : state.playState === "playing"
              ? null
              : { kind: "user", tick: currentTick },
      };
    }

    case "TICK": {
      if (state.playState !== "playing") return state;
      if (state.finalTick <= 0) return { ...state, playState: "buffering" };
      const next = clampTick(state.currentTick + action.deltaTicks, state.finalTick);
      if (next >= state.finalTick) {
        return {
          ...state,
          currentTick: state.finalTick,
          playState: "ended",
          pauseReason: { kind: "ended", tick: state.finalTick },
        };
      }
      return { ...state, currentTick: next };
    }

    case "REVIEW_HOLD": {
      const pauseReason = { kind: "review_hold" as const, tick: action.tick, coa_ids: action.coa_ids };
      if (!action.pause) {
        return {
          ...state,
          backendStatus: "review_hold",
          pauseReason,
          availableUntilTick: Math.max(state.availableUntilTick, action.tick),
          finalTick: Math.max(state.finalTick, action.tick),
        };
      }
      return {
        ...state,
        backendStatus: "review_hold",
        currentTick: clampTick(action.tick, Math.max(state.finalTick, action.tick)),
        availableUntilTick: Math.max(state.availableUntilTick, action.tick),
        finalTick: Math.max(state.finalTick, action.tick),
        playState: "paused",
        pauseReason,
      };
    }

    case "DONE":
      return {
        ...state,
        backendStatus: "complete",
        finalTick: Math.max(state.finalTick, action.finalTick),
        availableUntilTick: Math.max(state.availableUntilTick, action.finalTick),
        // Do not stop the playhead just because the backend finished. Completion
        // only means all replay data is available; local playback ends at finalTick.
        playState:
          state.playState === "playing" && state.currentTick < Math.max(state.finalTick, action.finalTick)
            ? "playing"
            : state.currentTick >= Math.max(state.finalTick, action.finalTick)
              ? "ended"
              : state.playState,
      };

    case "ERROR":
      return { ...state, backendStatus: "error", playState: "error" };

    case "SET_SPEED":
      return { ...state, playbackSpeed: Math.max(1, action.speed) };

    case "DROPPED_SSE_BLOCK":
      return { ...state, droppedSseBlocks: state.droppedSseBlocks + 1 };

    default:
      return state;
  }
}
