import { useMemo } from "react";
import type { PlaybackData } from "../playback";
import type { CourseOfAction, SimEvent } from "../types";
import { buildEffectiveCoaLog } from "../utils/effectiveCoaLog";
import {
  bestCoaInRange,
  computeGroupSummary,
  type GroupSummary,
  type TickRange,
} from "../utils/timelineGroupSelection";

export function useTimelineMoment({
  playback,
  events,
  coaLog,
  missionRisk = 0.5,
  range,
}: {
  playback: PlaybackData | null;
  events: SimEvent[];
  coaLog?: CourseOfAction[];
  missionRisk?: number;
  range: TickRange | null;
}): {
  summary: GroupSummary;
  bestCoa: CourseOfAction | null;
} {
  const effectiveCoaLog = useMemo(
    () => (playback ? buildEffectiveCoaLog(playback.frames, coaLog) : []),
    [playback, coaLog],
  );

  const summary = useMemo(
    () =>
      computeGroupSummary(
        events,
        range,
        playback?.mission_cutoff ?? 0,
        effectiveCoaLog,
        missionRisk,
        playback?.tick_seconds ?? 1,
        playback?.frames ?? [],
      ),
    [
      events,
      range,
      playback?.mission_cutoff,
      playback?.tick_seconds,
      playback?.frames,
      effectiveCoaLog,
      missionRisk,
    ],
  );

  const bestCoa = useMemo(() => bestCoaInRange(effectiveCoaLog, range), [effectiveCoaLog, range]);

  return { summary, bestCoa };
}
