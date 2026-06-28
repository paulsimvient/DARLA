import { TIMELINE_CONTENT_PAD_PX, tickToPx } from "./timelineGroupSelection";

export type TimelineMilestone = {
  id: string;
  tick: number;
  lineClass: string;
  badgeClass: string;
  label: string;
};

/** Stagger badge `top` offsets when milestone ticks map to nearby x positions. */
export function milestoneBadgeTops(
  milestones: TimelineMilestone[],
  pxPerTick: number,
  minPxGap = 64,
): Map<string, number> {
  const sorted = [...milestones].sort((a, b) => a.tick - b.tick || a.id.localeCompare(b.id));
  const tops = new Map<string, number>();
  const placed: { px: number; top: number }[] = [];

  for (const milestone of sorted) {
    const px = tickToPx(milestone.tick, pxPerTick, TIMELINE_CONTENT_PAD_PX);
    let top = 4;
    for (const other of placed) {
      if (Math.abs(other.px - px) < minPxGap) {
        top = Math.max(top, other.top + 18);
      }
    }
    tops.set(milestone.id, top);
    placed.push({ px, top });
  }

  return tops;
}
