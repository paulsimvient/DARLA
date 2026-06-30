import type { TimelineV2State } from "./timelineTypes";

export function timelineProgressPercent(state: TimelineV2State): number {
  if (state.finalTick <= 0) return 0;
  return Math.max(0, Math.min(100, (state.currentTick / state.finalTick) * 100));
}

export function backendStatusLabel(state: TimelineV2State): string {
  switch (state.backendStatus) {
    case "running":
      return `Backend streaming through T+${state.availableUntilTick}`;
    case "complete":
      return `Backend complete · replay through T+${state.finalTick}`;
    case "review_hold":
      return `Backend review hold · data through T+${state.availableUntilTick}`;
    case "loading":
      return "Backend starting";
    case "error":
      return "Backend error";
    default:
      return "Backend idle";
  }
}

export function playStateLabel(state: TimelineV2State): string {
  if (state.playState === "playing") return "Playing local replay clock";
  if (state.playState === "buffering") return "Buffering replay data";
  if (state.playState === "ended") return "Replay ended";
  if (state.pauseReason?.kind === "review_hold") return `Review hold at T+${state.pauseReason.tick}`;
  if (state.pauseReason?.kind === "breakpoint") return `Breakpoint at T+${state.pauseReason.tick}`;
  if (state.pauseReason?.kind === "user") return `Paused at T+${state.pauseReason.tick}`;
  return "Paused";
}
