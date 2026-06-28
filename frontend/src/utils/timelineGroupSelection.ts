import type { CourseOfAction, SimEvent } from "../types";
import { frameAtTick, type PlaybackData, type PlaybackFrame } from "../playback";
import { coasAtTick } from "./coaHelpers";
import { inferEventLane, type EventLane } from "./eventCategories";
import { filterKeyEvents, formatEventTitle } from "./keyEvents";
import { formatSimTime, formatSimTimeRange } from "./simTime";

export type TickRange = { start: number; end: number };

export type TimelineViewport = { start: number; end: number };

export const MIN_VIEWPORT_SPAN_TICKS = 24;

/** Fixed-scale timeline: each tick occupies this many pixels (scroll instead of compress). */
export const DEFAULT_PX_PER_TICK = 1;
export const MIN_PX_PER_TICK = 0.25;
export const MAX_PX_PER_TICK = 5;
export const TIMELINE_CONTENT_PAD_PX = 40;
export const TIMELINE_LABEL_GUTTER_PX = 88;

export function timelineContentWidth(maxTick: number, pxPerTick: number): number {
  return Math.max(480, maxTick * pxPerTick + TIMELINE_CONTENT_PAD_PX * 2);
}

export function tickToPx(tick: number, pxPerTick: number, padPx = TIMELINE_CONTENT_PAD_PX): number {
  return padPx + tick * pxPerTick;
}

export function pxToTick(px: number, pxPerTick: number, padPx = TIMELINE_CONTENT_PAD_PX): number {
  return Math.round((px - padPx) / pxPerTick);
}

export function clampPxPerTick(pxPerTick: number): number {
  return Math.max(MIN_PX_PER_TICK, Math.min(MAX_PX_PER_TICK, pxPerTick));
}

export function zoomPxPerTick(pxPerTick: number, factor: number): number {
  return clampPxPerTick(pxPerTick * factor);
}

/** Scale so tick 0 … maxTick fits in the visible timeline viewport (no phantom scroll width). */
export function pxPerTickToFit(
  maxTick: number,
  viewportWidthPx: number,
  gutterPx = TIMELINE_LABEL_GUTTER_PX,
): number {
  if (maxTick <= 0) return DEFAULT_PX_PER_TICK;
  const canvasViewport = Math.max(1, viewportWidthPx - gutterPx);
  const usable = canvasViewport - TIMELINE_CONTENT_PAD_PX * 2;
  return clampPxPerTick(usable / maxTick);
}

export function resolveTimelineMaxTick(
  playback: Pick<PlaybackData, "final_tick" | "max_ticks">,
  opts: {
    liveMode?: boolean;
    liveTick?: number;
    lastEventTick?: number;
    scenarioMaxTick?: number;
  } = {},
): number {
  const scenarioEnd = Math.max(
    playback.max_ticks ?? 0,
    opts.scenarioMaxTick ?? 0,
  );
  const progress = Math.max(
    playback.final_tick ?? 0,
    opts.liveMode ? opts.liveTick ?? 0 : 0,
    opts.lastEventTick ?? 0,
  );
  // Canvas spans the full scenario horizon; playhead shows live/replay progress separately.
  return Math.max(1, scenarioEnd || progress, progress);
}

export function isRangeActive(range: TickRange | null): range is TickRange {
  return range != null;
}

export function defaultViewport(maxTick: number): TimelineViewport {
  return { start: 0, end: maxTick };
}

export function normalizeViewport(view: TimelineViewport, maxTick: number): TimelineViewport {
  if (maxTick <= 0) return { start: 0, end: 0 };
  const minSpan = Math.min(MIN_VIEWPORT_SPAN_TICKS, maxTick);
  let span = Math.max(minSpan, view.end - view.start);
  span = Math.min(maxTick, span);
  let start = Math.max(0, Math.min(view.start, maxTick - span));
  let end = start + span;
  if (end > maxTick) {
    end = maxTick;
    start = Math.max(0, end - span);
  }
  return { start, end };
}

export function zoomViewport(
  view: TimelineViewport,
  maxTick: number,
  factor: number,
  anchorTick: number,
): TimelineViewport {
  const span = view.end - view.start;
  const nextSpan = Math.max(MIN_VIEWPORT_SPAN_TICKS, Math.min(maxTick, span / factor));
  const anchorRatio = span > 0 ? (anchorTick - view.start) / span : 0.5;
  let start = anchorTick - nextSpan * anchorRatio;
  let end = start + nextSpan;
  if (start < 0) {
    start = 0;
    end = nextSpan;
  }
  if (end > maxTick) {
    end = maxTick;
    start = maxTick - nextSpan;
  }
  return normalizeViewport({ start, end }, maxTick);
}

export function panViewport(view: TimelineViewport, maxTick: number, tickDelta: number): TimelineViewport {
  const span = view.end - view.start;
  let start = view.start + tickDelta;
  let end = start + span;
  if (start < 0) {
    start = 0;
    end = span;
  }
  if (end > maxTick) {
    end = maxTick;
    start = maxTick - span;
  }
  return normalizeViewport({ start, end }, maxTick);
}

export function tickInViewportPercent(tick: number, view: TimelineViewport): number {
  const span = view.end - view.start;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(100, ((tick - view.start) / span) * 100));
}

export function isFullViewport(view: TimelineViewport, maxTick: number): boolean {
  return view.start <= 0 && view.end >= maxTick;
}

export type TimelineDisplayLane = "cyber" | "detect" | "coa" | "exec";

export const TIMELINE_DISPLAY_LANES: {
  id: TimelineDisplayLane;
  label: string;
  sourceLanes: EventLane[];
  dotClass: string;
  lineClass: string;
}[] = [
  { id: "cyber", label: "Cyber", sourceLanes: ["cyber", "causal"], dotClass: "bg-red-500", lineClass: "bg-red-500/30" },
  { id: "detect", label: "Detect", sourceLanes: ["detection"], dotClass: "bg-amber-400", lineClass: "bg-amber-400/30" },
  { id: "coa", label: "COA", sourceLanes: ["coa"], dotClass: "bg-blue-500", lineClass: "bg-blue-500/30" },
  { id: "exec", label: "Exec", sourceLanes: ["execution", "authority"], dotClass: "bg-emerald-500", lineClass: "bg-emerald-500/30" },
];

export const COA_REVIEW_INTERVAL_TICKS = 60;

export function displayLaneForEvent(event: SimEvent): TimelineDisplayLane {
  const lane = inferEventLane(event);
  for (const display of TIMELINE_DISPLAY_LANES) {
    if (display.sourceLanes.includes(lane)) return display.id;
  }
  return "cyber";
}

export function eventsForDisplayLane(
  events: SimEvent[],
  laneId: TimelineDisplayLane,
  pxPerTick = DEFAULT_PX_PER_TICK,
): SimEvent[] {
  return thinLaneMarkers(timelineMarkersForLane(events, laneId), pxPerTick, laneId);
}

/** Hide overlapping markers when zoomed out so lanes stay readable. */
export function thinLaneMarkers(
  markers: SimEvent[],
  pxPerTick: number,
  laneId: TimelineDisplayLane,
): SimEvent[] {
  if (markers.length <= 1) return markers;
  const minGapPx = laneId === "coa" ? Math.max(48, COA_REVIEW_INTERVAL_TICKS * pxPerTick * 0.75) : 22;
  const sorted = [...markers].sort((a, b) => a.tick - b.tick || a.event_id - b.event_id);
  const visible: SimEvent[] = [sorted[0]];
  let lastPx = sorted[0].tick * pxPerTick;

  for (let i = 1; i < sorted.length; i += 1) {
    const px = sorted[i].tick * pxPerTick;
    if (px - lastPx >= minGapPx) {
      visible.push(sorted[i]);
      lastPx = px;
    }
  }

  if (visible[visible.length - 1]?.event_id !== sorted[sorted.length - 1].event_id) {
    visible.push(sorted[sorted.length - 1]);
  }
  return visible;
}

/** Lane dots are navigation anchors, not a 1:1 ledger dump. */
export function timelineMarkersForLane(events: SimEvent[], laneId: TimelineDisplayLane): SimEvent[] {
  const key = filterKeyEvents(events);

  if (laneId === "coa") {
    // Commander review cadence: one marker per review tick (sim emits coa_recommendation each cycle).
    const byTick = new Map<number, SimEvent>();
    for (const event of key) {
      if (event.label !== "coa_recommendation" && !event.label.startsWith("python_coa:")) continue;
      if (!byTick.has(event.tick)) byTick.set(event.tick, event);
    }
    return [...byTick.values()].sort((a, b) => a.tick - b.tick || a.event_id - b.event_id);
  }

  if (laneId === "cyber") {
    return key
      .filter((event) => displayLaneForEvent(event) === "cyber")
      .filter((event) => !isPeriodicMonitoringEvent(event));
  }

  if (laneId === "detect") {
    return key
      .filter((event) => displayLaneForEvent(event) === "detect")
      .filter((event) => event.deltas.some((d) => d.before !== d.after) || event.label.includes("detect"));
  }

  if (laneId === "exec") {
    return key.filter((event) => displayLaneForEvent(event) === "exec");
  }

  return key.filter((event) => displayLaneForEvent(event) === laneId);
}

function isPeriodicMonitoringEvent(event: SimEvent): boolean {
  const label = event.label.toLowerCase();
  if (label.endsWith("_monitoring")) return true;
  if (label.includes("fmu_step")) return true;
  return false;
}

export function markerTitle(
  event: SimEvent,
  laneId: TimelineDisplayLane,
  tickSeconds = 1,
): string {
  if (laneId === "coa") {
    return `${formatSimTime(event.tick, tickSeconds)} · COA review window · ${formatEventTitle(event)} · tick ${event.tick}`;
  }
  return `${formatSimTime(event.tick, tickSeconds)} · ${formatEventTitle(event)} · tick ${event.tick}`;
}

export function normalizeRange(start: number, end: number, maxTick: number): TickRange | null {
  if (maxTick < 0) return null;
  const rawLo = Math.min(start, end);
  const rawHi = Math.max(start, end);
  if (rawLo > maxTick) return null;
  const lo = Math.max(0, rawLo);
  const hi = Math.min(maxTick, rawHi);
  return { start: lo, end: Math.max(lo, hi) };
}

export function rangeAroundTick(tick: number, maxTick: number, padding = 60): TickRange | null {
  return normalizeRange(tick - padding, tick + padding, maxTick);
}

export function defaultGroupRange(events: SimEvent[], currentTick: number, maxTick: number): TickRange | null {
  const key = filterKeyEvents(events).filter((event) => event.tick <= currentTick);
  if (key.length >= 2) {
    const slice = key.slice(-4);
    return normalizeRange(slice[0].tick, slice[slice.length - 1].tick, maxTick);
  }
  return normalizeRange(Math.max(0, currentTick - 120), currentTick, maxTick);
}

export function eventsInRange(events: SimEvent[], range: TickRange | null): SimEvent[] {
  if (!range) return [];
  return filterKeyEvents(events)
    .filter((event) => event.tick >= range.start && event.tick <= range.end)
    .sort((a, b) => a.tick - b.tick || a.event_id - b.event_id);
}

export function eventInRange(event: SimEvent, range: TickRange | null): boolean {
  if (!range) return false;
  return event.tick >= range.start && event.tick <= range.end;
}

export type MetricDelta = {
  label: string;
  start: string;
  end: string;
  direction: "up" | "down" | "flat";
  tone: "good" | "bad" | "warn" | "neutral";
};

export type LaneBreakdownItem = {
  id: TimelineDisplayLane;
  label: string;
  count: number;
  dotClass: string;
};

export type CoaInRangeItem = {
  action: string;
  target: string;
  score: number;
  tick: number;
};

export type StateChangeItem = {
  field: string;
  before: string;
  after: string;
  eventLabel: string;
  tick: number;
};

export type GroupSummary = {
  eventCount: number;
  coaCount: number;
  risk: number;
  mode: "branch" | "execute";
  modeLabel: string;
  recommendationLabel: string;
  summaryText: string;
  footerStatus: string;
  rangeLabel: string;
  metricDeltas: MetricDelta[];
  laneBreakdown: LaneBreakdownItem[];
  coasInRange: CoaInRangeItem[];
  stateChanges: StateChangeItem[];
};

function deltaSummary(event: SimEvent): string {
  const delta = event.deltas.find((d) => d.before !== d.after);
  if (!delta) return event.provenance || event.type;
  return `${delta.field}: ${delta.before} → ${delta.after}`;
}

function emptyGroupSummary(missionRisk: number): GroupSummary {
  return {
    eventCount: 0,
    coaCount: 0,
    risk: missionRisk,
    mode: "execute",
    modeLabel: "no selection",
    recommendationLabel: "—",
    summaryText: "Click an event or drag a window on the timeline to inspect a moment.",
    footerStatus: "no moment selected · drag timeline or click an event",
    rangeLabel: "—",
    metricDeltas: [],
    laneBreakdown: [],
    coasInRange: [],
    stateChanges: [],
  };
}

function numericDelta(
  label: string,
  start: number,
  end: number,
  higherIsGood: boolean,
): MetricDelta {
  const diff = end - start;
  const direction = Math.abs(diff) < 0.005 ? "flat" : diff > 0 ? "up" : "down";
  let tone: MetricDelta["tone"] = "neutral";
  if (direction !== "flat") {
    const improved = higherIsGood ? diff > 0 : diff < 0;
    tone = improved ? "good" : diff > 0 ? "bad" : "warn";
  }
  return {
    label,
    start: start.toFixed(2),
    end: end.toFixed(2),
    direction,
    tone,
  };
}

function coasInWindow(coaLog: CourseOfAction[] | undefined, range: TickRange): CoaInRangeItem[] {
  if (!coaLog?.length) return [];
  const candidates = new Map<number, CourseOfAction>();
  for (const coa of coaLog) {
    if (coa.proposed_tick >= range.start && coa.proposed_tick <= range.end) {
      candidates.set(coa.id, coa);
    }
  }
  return [...candidates.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((coa) => ({
      action: coa.action.replace(/_/g, " "),
      target: coa.target,
      score: coa.score,
      tick: coa.proposed_tick,
    }));
}

function buildMetricDeltas(
  startFrame: PlaybackFrame | null,
  endFrame: PlaybackFrame | null,
): MetricDelta[] {
  if (!startFrame || !endFrame) return [];

  const deltas: MetricDelta[] = [
    numericDelta(
      "Success score",
      startFrame.metrics.mission_success_score,
      endFrame.metrics.mission_success_score,
      true,
    ),
    numericDelta("Mission risk", startFrame.agent_beliefs?.mission_risk ?? 0, endFrame.agent_beliefs?.mission_risk ?? 0, false),
    numericDelta(
      "Sensor trust",
      startFrame.agent_beliefs?.sensor_trust ?? 0,
      endFrame.agent_beliefs?.sensor_trust ?? 0,
      true,
    ),
  ];

  if (startFrame.metrics.target_detected !== endFrame.metrics.target_detected) {
    deltas.push({
      label: "Target detected",
      start: startFrame.metrics.target_detected ? "yes" : "no",
      end: endFrame.metrics.target_detected ? `yes @ T+${endFrame.metrics.detection_time}` : "no",
      direction: endFrame.metrics.target_detected ? "up" : "down",
      tone: endFrame.metrics.target_detected ? "good" : "bad",
    });
  }

  const startComms = startFrame.agent_beliefs?.comms_health;
  const endComms = endFrame.agent_beliefs?.comms_health;
  if (startComms != null && endComms != null && Math.abs(startComms - endComms) >= 0.01) {
    deltas.push(numericDelta("Comms health", startComms, endComms, true));
  }

  return deltas;
}

function buildStateChanges(selected: SimEvent[]): StateChangeItem[] {
  const seen = new Set<string>();
  const changes: StateChangeItem[] = [];
  for (const event of selected) {
    for (const delta of event.deltas) {
      if (delta.before === delta.after || seen.has(delta.field)) continue;
      seen.add(delta.field);
      changes.push({
        field: delta.field,
        before: delta.before,
        after: delta.after,
        eventLabel: event.label.replace(/_/g, " "),
        tick: event.tick,
      });
      if (changes.length >= 6) return changes;
    }
  }
  return changes;
}

export function computeGroupSummary(
  events: SimEvent[],
  range: TickRange | null,
  missionCutoff: number,
  coaLog: CourseOfAction[] | undefined,
  missionRisk = 0.5,
  tickSeconds = 1,
  frames: PlaybackFrame[] = [],
): GroupSummary {
  if (!range) {
    return emptyGroupSummary(missionRisk);
  }

  const selected = eventsInRange(events, range);
  const coaIds = new Set<number>();
  for (const event of selected) {
    for (const coa of coasAtTick(coaLog ?? [], event.tick)) {
      coaIds.add(coa.id);
    }
  }
  const startFrame = frameAtTick(frames, range.start);
  const endFrame = frameAtTick(frames, range.end);
  const rangeRisk = endFrame?.agent_beliefs?.mission_risk ?? missionRisk;
  const bestCoa = bestCoaInRange(coaLog, range);
  const pastCutoff = range.end >= missionCutoff;
  const mode = pastCutoff ? "branch" : "execute";
  const modeLabel = pastCutoff ? "what-if window" : "intervention window";
  const recommendationLabel = bestCoa
    ? `${bestCoa.action.replace(/_/g, " ")} → ${bestCoa.target}`
    : pastCutoff
      ? "Branch"
      : "Review";
  const rangeLabel = formatSimTimeRange(range.start, range.end, tickSeconds, true);

  const laneCounts = selected.reduce(
    (acc, event) => {
      const lane = displayLaneForEvent(event);
      acc[lane] = (acc[lane] ?? 0) + 1;
      return acc;
    },
    {} as Record<TimelineDisplayLane, number>,
  );
  const laneBreakdown = TIMELINE_DISPLAY_LANES.map((lane) => ({
    id: lane.id,
    label: lane.label,
    count: laneCounts[lane.id] ?? 0,
    dotClass: lane.dotClass,
  })).filter((lane) => lane.count > 0);

  const laneParts = laneBreakdown.map((lane) => `${lane.count} ${lane.id}`).join(", ");

  return {
    eventCount: selected.length,
    coaCount: coaIds.size,
    risk: rangeRisk,
    mode,
    modeLabel,
    recommendationLabel,
    rangeLabel,
    metricDeltas: buildMetricDeltas(startFrame, endFrame),
    laneBreakdown,
    coasInRange: coasInWindow(coaLog, range),
    stateChanges: buildStateChanges(selected),
    summaryText:
      selected.length > 0
        ? `${selected.length} events (${laneParts || "mixed"}) within ${rangeLabel}.`
        : "No key events in selected window.",
    footerStatus: `selected ${rangeLabel} · ${selected.length} events · ${coaIds.size} COAs · ${modeLabel}`,
  };
}

export function groupStoryLines(
  events: SimEvent[],
  range: TickRange | null,
  tickSeconds = 1,
): { title: string; body: string }[] {
  const selected = eventsInRange(events, range);
  if (selected.length === 0) {
    return [{ title: "No selected events", body: "Click an event or drag across the timeline to inspect a moment." }];
  }
  return selected.slice(0, 5).map((event, index) => ({
    title: `${index + 1}. ${event.label.replace(/_/g, " ") || event.type}`,
    body: `${formatSimTime(event.tick, tickSeconds)} · ${deltaSummary(event)}`,
  }));
}

export function bestCoaInRange(coaLog: CourseOfAction[] | undefined, range: TickRange | null): CourseOfAction | null {
  if (!range || !coaLog?.length) return null;
  const candidates = new Map<number, CourseOfAction>();
  for (const coa of coaLog) {
    if (coa.proposed_tick >= range.start && coa.proposed_tick <= range.end) {
      candidates.set(coa.id, coa);
    }
  }
  const ranked = [...candidates.values()].sort((a, b) => b.score - a.score);
  return ranked[0] ?? null;
}
