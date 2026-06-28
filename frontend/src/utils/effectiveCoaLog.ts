import type { PlaybackFrame } from "../playback";
import type { CourseOfAction } from "../types";

/** Merge post-run dashboard COA log with COAs streamed on each live frame. */
export function buildEffectiveCoaLog(
  frames: PlaybackFrame[],
  dashboardCoaLog: CourseOfAction[] | undefined,
): CourseOfAction[] {
  const byId = new Map<number, CourseOfAction>();
  for (const frame of frames) {
    for (const coa of frame.coa_recommendations ?? []) {
      byId.set(coa.id, { ...coa, proposed_tick: coa.proposed_tick ?? frame.tick });
    }
    if (frame.active_coa) {
      byId.set(frame.active_coa.id, frame.active_coa);
    }
  }
  for (const coa of dashboardCoaLog ?? []) {
    byId.set(coa.id, coa);
  }
  return [...byId.values()].sort((a, b) => a.proposed_tick - b.proposed_tick || a.id - b.id);
}
