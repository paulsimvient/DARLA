import type { PlaybackData, PlaybackFrame } from "../playback";
import type { RunIdentity, SimEvent } from "../types";
import { eventsInRange, type TickRange } from "./timelineGroupSelection";
import { frameAtTick } from "../playback";

export type MomentPacket = {
  version: 1;
  captured_at: string;
  range: TickRange;
  run: {
    run_id?: string;
    branch_id?: string;
    seed?: number;
    scenario_id?: string;
    replay_hash?: string;
    authorization_mode?: string;
  };
  summary: {
    event_count: number;
    mission_risk: number | null;
  };
  events: SimEvent[];
  frames: PlaybackFrame[];
  playback: Pick<PlaybackData, "scenario_id" | "seed" | "mission_cutoff" | "tick_seconds" | "final_tick">;
};

export function buildMomentPacket(input: {
  range: TickRange;
  events: SimEvent[];
  frames: PlaybackFrame[];
  playback: PlaybackData;
  runIdentity: RunIdentity | null;
}): MomentPacket {
  const inRangeEvents = eventsInRange(input.events, input.range);
  const endFrame = frameAtTick(input.frames, input.range.end);

  return {
    version: 1,
    captured_at: new Date().toISOString(),
    range: input.range,
    run: {
      run_id: input.runIdentity?.run_id,
      branch_id: input.runIdentity?.branch_id,
      seed: input.runIdentity?.seed ?? input.playback.seed,
      scenario_id: input.runIdentity?.scenario_id ?? input.playback.scenario_id,
      replay_hash: input.runIdentity?.replay_hash,
      authorization_mode: input.runIdentity?.authorization_mode ?? input.playback.authorization_mode,
    },
    summary: {
      event_count: inRangeEvents.length,
      mission_risk: endFrame?.agent_beliefs?.mission_risk ?? null,
    },
    events: inRangeEvents,
    frames: input.frames.filter(
      (frame) => frame.tick >= input.range.start && frame.tick <= input.range.end,
    ),
    playback: {
      scenario_id: input.playback.scenario_id,
      seed: input.playback.seed,
      mission_cutoff: input.playback.mission_cutoff,
      tick_seconds: input.playback.tick_seconds,
      final_tick: input.playback.final_tick,
    },
  };
}

export function downloadMomentPacket(packet: MomentPacket, filename?: string) {
  const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download =
    filename ??
    `darla-moment-T${packet.range.start}-T${packet.range.end}-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
