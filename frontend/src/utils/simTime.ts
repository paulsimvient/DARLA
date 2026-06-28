/** Simulation tick → mission elapsed time (scenario tick_seconds). */

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

const AXIS_STEP_SECONDS = [
  5,
  10,
  15,
  30,
  MINUTE,
  5 * MINUTE,
  15 * MINUTE,
  HOUR,
  6 * HOUR,
  DAY,
  WEEK,
  MONTH,
];

export function tickToMissionSeconds(tick: number, tickSeconds: number): number {
  return Math.max(0, tick * tickSeconds);
}

export function formatSimTime(tick: number, tickSeconds: number, compact = false): string {
  const totalSeconds = tickToMissionSeconds(tick, tickSeconds);

  if (totalSeconds < HOUR) {
    const m = Math.floor(totalSeconds / MINUTE);
    const s = Math.floor(totalSeconds % MINUTE);
    if (m === 0) return `${s}s`;
    return compact && s === 0 ? `${m}m` : `${m}m ${s}s`;
  }

  if (totalSeconds < DAY) {
    const h = Math.floor(totalSeconds / HOUR);
    const m = Math.floor((totalSeconds % HOUR) / MINUTE);
    return compact && m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  if (totalSeconds < WEEK) {
    const d = Math.floor(totalSeconds / DAY);
    const h = Math.floor((totalSeconds % DAY) / HOUR);
    return compact && h === 0 ? `${d}d` : `${d}d ${h}h`;
  }

  if (totalSeconds < MONTH) {
    const w = Math.floor(totalSeconds / WEEK);
    const d = Math.floor((totalSeconds % WEEK) / DAY);
    return compact && d === 0 ? `${w}w` : `${w}w ${d}d`;
  }

  const mo = Math.floor(totalSeconds / MONTH);
  const w = Math.floor((totalSeconds % MONTH) / WEEK);
  return compact && w === 0 ? `${mo}mo` : `${mo}mo ${w}w`;
}

export function formatSimTimeRange(
  startTick: number,
  endTick: number,
  tickSeconds: number,
  compact = false,
): string {
  if (startTick === endTick) return formatSimTime(startTick, tickSeconds, compact);
  return `${formatSimTime(startTick, tickSeconds, compact)} → ${formatSimTime(endTick, tickSeconds, compact)}`;
}

/** Axis labels: mission time primary, tick index secondary in tooltips only. */
export function formatSimTimeAxis(tick: number, tickSeconds: number): string {
  return formatSimTime(tick, tickSeconds, true);
}

export function formatSimTimeDetail(tick: number, tickSeconds: number): string {
  return `${formatSimTime(tick, tickSeconds)} · tick ${tick}`;
}

export function chooseAxisStepTicks(
  tickSeconds: number,
  pxPerTick: number,
  minLabelPx = 130,
): number {
  const minStepTicks = Math.max(1, minLabelPx / pxPerTick);
  for (const stepSeconds of AXIS_STEP_SECONDS) {
    const stepTicks = stepSeconds / tickSeconds;
    if (stepTicks >= minStepTicks) return Math.max(1, Math.round(stepTicks));
  }
  const fallback = AXIS_STEP_SECONDS[AXIS_STEP_SECONDS.length - 1] / tickSeconds;
  return Math.max(1, Math.round(fallback));
}

export function buildAxisTicks(maxTick: number, stepTicks: number): number[] {
  if (maxTick <= 0) return [0];
  const marks: number[] = [];
  for (let tick = 0; tick <= maxTick; tick += stepTicks) marks.push(tick);
  if (marks[marks.length - 1] !== maxTick) marks.push(maxTick);
  return marks;
}
