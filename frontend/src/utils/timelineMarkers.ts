import type { SimEvent } from "../types";
import { filterKeyEvents, formatEventTitle } from "./keyEvents";
import {
  COA_REVIEW_INTERVAL_TICKS,
  displayLaneForEvent,
  type TimelineDisplayLane,
} from "./timelineGroupSelection";

export type MarkerSignificance = "minor" | "major" | "urgent";

export type TimelineLaneMarkerModel = {
  event: SimEvent;
  significance: MarkerSignificance;
  clusterCount: number;
  headline: string;
  inspectPrompt: string;
};

function deltaAfter(event: SimEvent, fieldSuffix: string): string {
  const delta = event.deltas.find(
    (entry) => entry.field === fieldSuffix || entry.field.endsWith(`.${fieldSuffix}`),
  );
  return delta?.after ?? "";
}

function topCoaSignature(event: SimEvent): string {
  const action = deltaAfter(event, "coa.rank.1.action");
  const score = deltaAfter(event, "coa.rank.1.score");
  const target = deltaAfter(event, "coa.rank.1.target") || "none";
  return `${action}|${target}|${score}`;
}

function causalPatternsSignature(event: SimEvent): string {
  return deltaAfter(event, "causal.patterns");
}

function isCoaReviewEvent(event: SimEvent): boolean {
  return event.label === "coa_recommendation" || event.label.startsWith("python_coa:");
}

function isCyberThreatEvent(event: SimEvent): boolean {
  const label = event.label.toLowerCase();
  if (label.endsWith("_monitoring")) return false;
  if (label.includes("fmu_step")) return false;
  if (label === "red_cyber_degradation" || label === "red_cyber_agent_decision") return true;
  if (label === "causal_monitor_warning") return true;
  if (label.includes("sensor_confidence") || label.includes("delayed_target") || label.includes("late_target")) {
    return true;
  }
  if (label.includes("tempo_stress") || label.includes("pre_failure")) return true;
  if (label.includes("cyber") && !label.includes("monitoring")) return true;
  if (label.includes("degrad") || label.includes("compromis") || label.includes("jam")) return true;
  if (label.includes("emergent") || label.includes("confound")) return true;
  return false;
}

export function classifyMarkerSignificance(
  event: SimEvent,
  laneId: TimelineDisplayLane,
): MarkerSignificance {
  const label = event.label.toLowerCase();
  if (
    label === "causal_monitor_warning" ||
    label === "red_cyber_degradation" ||
    label === "red_cyber_agent_decision" ||
    label.includes("pre_failure") ||
    label.includes("tempo_stress")
  ) {
    return "urgent";
  }
  if (
    laneId === "coa" ||
    label.includes("detect") ||
    label.includes("target") ||
    label.includes("approved") ||
    label.includes("reject")
  ) {
    return "major";
  }
  return "minor";
}

export function markerHeadline(event: SimEvent, laneId: TimelineDisplayLane): string {
  const title = formatEventTitle(event);
  if (laneId === "coa") {
    const action = deltaAfter(event, "coa.rank.1.action").replace(/_/g, " ");
    return action ? `COA review · ${action}` : `COA review · ${title}`;
  }
  if (laneId === "cyber" && event.label === "causal_monitor_warning") {
    const patterns = causalPatternsSignature(event);
    return patterns ? `Causal warning · ${patterns.replace(/,/g, ", ")}` : `Causal warning · ${title}`;
  }
  return title;
}

export function markerInspectPrompt(laneId: TimelineDisplayLane): string {
  switch (laneId) {
    case "cyber":
      return "What happened, what asset was affected, what evidence supports it, and what might happen next?";
    case "coa":
      return "What decision is available, what COAs are being compared, and what action is recommended?";
    case "detect":
      return "Review confidence, source, and classification for this detection change.";
    case "exec":
      return "Confirm what action was taken and the expected operational effect.";
    default:
      return "Inspect cause, evidence, impact, and recommended response.";
  }
}

function buildCoaMarkerModels(events: SimEvent[]): TimelineLaneMarkerModel[] {
  const reviews = events
    .filter(isCoaReviewEvent)
    .sort((a, b) => a.tick - b.tick || a.event_id - b.event_id);

  const models: TimelineLaneMarkerModel[] = [];
  let previousSignature = "";

  for (const event of reviews) {
    const signature = topCoaSignature(event);
    const materiallyChanged = signature !== previousSignature;
    const firstReview = models.length === 0;

    if (!firstReview && !materiallyChanged) {
      continue;
    }

    models.push({
      event,
      significance: materiallyChanged || firstReview ? "major" : "minor",
      clusterCount: 1,
      headline: markerHeadline(event, "coa"),
      inspectPrompt: markerInspectPrompt("coa"),
    });
    previousSignature = signature;
  }

  return models;
}

function buildCyberMarkerModels(events: SimEvent[]): TimelineLaneMarkerModel[] {
  const candidates = events
    .filter((event) => displayLaneForEvent(event) === "cyber" && isCyberThreatEvent(event))
    .sort((a, b) => a.tick - b.tick || a.event_id - b.event_id);

  const models: TimelineLaneMarkerModel[] = [];
  let previousPatterns = "";

  for (const event of candidates) {
    if (event.label === "causal_monitor_warning") {
      const patterns = causalPatternsSignature(event);
      if (patterns && patterns === previousPatterns) {
        continue;
      }
      previousPatterns = patterns;
    }

    models.push({
      event,
      significance: classifyMarkerSignificance(event, "cyber"),
      clusterCount: 1,
      headline: markerHeadline(event, "cyber"),
      inspectPrompt: markerInspectPrompt("cyber"),
    });
  }

  return models;
}

function buildDetectMarkerModels(events: SimEvent[]): TimelineLaneMarkerModel[] {
  return events
    .filter((event) => displayLaneForEvent(event) === "detect")
    .filter(
      (event) =>
        event.deltas.some((delta) => delta.before !== delta.after) || event.label.toLowerCase().includes("detect"),
    )
    .map((event) => ({
      event,
      significance: classifyMarkerSignificance(event, "detect"),
      clusterCount: 1,
      headline: markerHeadline(event, "detect"),
      inspectPrompt: markerInspectPrompt("detect"),
    }));
}

function buildExecMarkerModels(events: SimEvent[]): TimelineLaneMarkerModel[] {
  return events
    .filter((event) => displayLaneForEvent(event) === "exec")
    .map((event) => ({
      event,
      significance: classifyMarkerSignificance(event, "exec"),
      clusterCount: 1,
      headline: markerHeadline(event, "exec"),
      inspectPrompt: markerInspectPrompt("exec"),
    }));
}

export function buildLaneMarkerModels(
  events: SimEvent[],
  laneId: TimelineDisplayLane,
): TimelineLaneMarkerModel[] {
  const key = filterKeyEvents(events);
  switch (laneId) {
    case "coa":
      return buildCoaMarkerModels(key);
    case "cyber":
      return buildCyberMarkerModels(key);
    case "detect":
      return buildDetectMarkerModels(key);
    case "exec":
      return buildExecMarkerModels(key);
    default:
      return [];
  }
}

/** Hide overlapping markers when zoomed out; accumulate hidden siblings into clusterCount. */
export function thinMarkerModels(
  markers: TimelineLaneMarkerModel[],
  pxPerTick: number,
  laneId: TimelineDisplayLane,
): TimelineLaneMarkerModel[] {
  if (markers.length <= 1) return markers;

  // Tick-based spacing keeps the full mission graph visible when "fit all" compresses px/tick.
  const minGapTicks =
    laneId === "coa"
      ? Math.max(24, Math.round(COA_REVIEW_INTERVAL_TICKS * 0.5))
      : laneId === "cyber"
        ? 45
        : 30;
  const minGapPx = Math.max(10, minGapTicks * pxPerTick);

  const sorted = [...markers].sort(
    (a, b) => a.event.tick - b.event.tick || a.event.event_id - b.event.event_id,
  );
  const visible: TimelineLaneMarkerModel[] = [{ ...sorted[0] }];
  let lastTick = sorted[0].event.tick;
  let lastPx = sorted[0].event.tick * pxPerTick;

  for (let index = 1; index < sorted.length; index += 1) {
    const marker = sorted[index];
    const px = marker.event.tick * pxPerTick;
    const tickGap = marker.event.tick - lastTick;
    if (tickGap >= minGapTicks && px - lastPx >= minGapPx) {
      visible.push({ ...marker });
      lastTick = marker.event.tick;
      lastPx = px;
      continue;
    }

    const bucket = visible[visible.length - 1];
    bucket.clusterCount += 1;
    if (marker.significance === "urgent" || (marker.significance === "major" && bucket.significance === "minor")) {
      bucket.significance = marker.significance;
      bucket.event = marker.event;
      bucket.headline = marker.headline;
    }
  }

  const last = sorted[sorted.length - 1];
  const tail = visible[visible.length - 1];
  if (tail?.event.event_id !== last.event.event_id) {
    visible.push({ ...last });
  }

  return visible;
}

export function laneMarkersForDisplay(
  events: SimEvent[],
  laneId: TimelineDisplayLane,
  pxPerTick: number,
): TimelineLaneMarkerModel[] {
  return thinMarkerModels(buildLaneMarkerModels(events, laneId), pxPerTick, laneId);
}

const DISPLAY_LANES: TimelineDisplayLane[] = ["cyber", "detect", "coa", "exec"];

function visibleMarkerTicks(
  events: SimEvent[],
  pxPerTick: number,
  maxTick: number,
): Map<number, SimEvent> {
  const byTick = new Map<number, SimEvent>();
  for (const lane of DISPLAY_LANES) {
    for (const marker of laneMarkersForDisplay(events, lane, pxPerTick)) {
      if (marker.event.tick <= maxTick) {
        byTick.set(marker.event.tick, marker.event);
      }
    }
  }
  return byTick;
}

/** Snap inspect/seek to the nearest on-canvas timeline marker (not arbitrary ticks). */
export function snapSeekToNearestMarker(
  tick: number,
  events: SimEvent[],
  pxPerTick: number,
  maxTick: number,
  opts?: { preferAtOrBefore?: boolean },
): { tick: number; event: SimEvent | null } {
  const clamped = Math.max(0, Math.min(maxTick, tick));
  const markers = visibleMarkerTicks(events, pxPerTick, maxTick);

  if (opts?.preferAtOrBefore) {
    const markerTicks = [...markers.keys()].filter((markerTick) => markerTick <= clamped);
    if (markerTicks.length > 0) {
      const bestTick = Math.max(...markerTicks);
      return { tick: bestTick, event: markers.get(bestTick) ?? null };
    }

    const keyBefore = filterKeyEvents(events).filter((event) => event.tick <= clamped);
    if (keyBefore.length > 0) {
      const best = keyBefore.reduce((left, right) => (right.tick > left.tick ? right : left));
      return { tick: best.tick, event: best };
    }

    return { tick: clamped, event: null };
  }

  if (markers.size === 0) {
    const key = filterKeyEvents(events).filter((event) => event.tick <= maxTick);
    if (key.length === 0) {
      return { tick: Math.max(0, Math.min(maxTick, tick)), event: null };
    }
    let nearest = key[0];
    let bestDist = Math.abs(nearest.tick - tick);
    for (const event of key) {
      const dist = Math.abs(event.tick - tick);
      if (dist < bestDist) {
        bestDist = dist;
        nearest = event;
      }
    }
    return { tick: nearest.tick, event: nearest };
  }

  let bestTick = tick;
  let bestDist = Infinity;
  for (const markerTick of markers.keys()) {
    const dist = Math.abs(markerTick - tick);
    if (dist < bestDist) {
      bestDist = dist;
      bestTick = markerTick;
    }
  }
  return { tick: bestTick, event: markers.get(bestTick) ?? null };
}
