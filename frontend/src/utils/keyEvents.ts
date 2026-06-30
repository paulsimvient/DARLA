import type { SimEvent } from "../types";

const ROUTINE_LABELS = [
  /^fmu_step:/,
  /_monitoring$/,
  /^credibility_monitoring$/,
  /^sensor_agent_monitoring$/,
  /^causal_monitor_monitoring$/,
  /^commander_monitoring$/,
  /^red_cyber_monitoring$/,
];

export function isRoutineEvent(event: SimEvent): boolean {
  if (ROUTINE_LABELS.some((pattern) => pattern.test(event.label))) return true;
  if (event.type === "Observe" && event.label.startsWith("fmu_step:")) return true;
  return false;
}

export function isKeyEvent(event: SimEvent): boolean {
  if (isRoutineEvent(event)) return false;
  if (event.deltas.some((d) => d.before !== d.after)) return true;

  const haystack = `${event.type} ${event.label}`.toLowerCase();
  if (haystack.includes("cyber") || haystack.includes("degrad")) return true;
  if (haystack.includes("detect") || haystack.includes("target")) return true;
  if (haystack.includes("coa") || haystack.includes("decide")) return true;
  if (haystack.includes("intervention") || haystack.includes("mission")) return true;
  if (haystack.includes("emergent") || haystack.includes("loss")) return true;
  if (event.type !== "Observe") return true;

  return false;
}

export type TimelineDisplayClass = "routine" | "marker" | "major" | "critical";

export type TimelinePausePolicy =
  | "never"
  | "notify_only"
  | "pause_if_user_enabled"
  | "always_pause";

export type TimelineEventLane =
  | "authority"
  | "causal"
  | "coa"
  | "cyber"
  | "execution"
  | "observation"
  | "warning";

export type TimelineEventClassification = {
  displayClass: TimelineDisplayClass;
  pausePolicy: TimelinePausePolicy;
  lane: TimelineEventLane;
  severity: number;
  dedupeKey: string;
};

function deltaValue(event: SimEvent, field: string): string {
  return event.deltas.find((delta) => delta.field === field)?.after ?? "";
}

/**
 * Classifies event importance separately from playback control.
 *
 * The old UI treated every key event as a reason to stop the timeline. That made
 * recurring COA and causal-monitor events look like playback failures. This
 * classifier preserves those events as visible markers while only allowing a
 * narrow set of events to pause playback.
 */
export function classifyTimelineEvent(event: SimEvent): TimelineEventClassification {
  if (isRoutineEvent(event)) {
    return {
      displayClass: "routine",
      pausePolicy: "never",
      lane: "observation",
      severity: 5,
      dedupeKey: event.label,
    };
  }

  if (event.label === "review_hold") {
    return {
      displayClass: "critical",
      pausePolicy: "always_pause",
      lane: "authority",
      severity: 95,
      dedupeKey: `review_hold:${event.tick}`,
    };
  }

  if (event.label === "online_agent_decision") {
    return {
      displayClass: "critical",
      pausePolicy: "pause_if_user_enabled",
      lane: "authority",
      severity: 90,
      dedupeKey: `decision:${deltaValue(event, "agent.selected_action")}`,
    };
  }

  if (event.label.includes("coa_recommendation")) {
    return {
      displayClass: "major",
      pausePolicy: "notify_only",
      lane: "coa",
      severity: 70,
      dedupeKey: `coa:${deltaValue(event, "coa.rank.1.action")}:${deltaValue(event, "coa.rank.1.score")}`,
    };
  }

  if (event.label === "causal_monitor_warning") {
    return {
      displayClass: "major",
      pausePolicy: "notify_only",
      lane: "causal",
      severity: 75,
      dedupeKey: `causal:${event.deltas.map((delta) => `${delta.field}:${delta.after}`).join("|")}`,
    };
  }

  const haystack = `${event.type} ${event.label}`.toLowerCase();
  if (haystack.includes("cyber") || haystack.includes("attack") || haystack.includes("compromis")) {
    return {
      displayClass: "critical",
      pausePolicy: "pause_if_user_enabled",
      lane: "cyber",
      severity: 88,
      dedupeKey: event.label,
    };
  }

  if (haystack.includes("mission") || haystack.includes("fail") || haystack.includes("loss")) {
    return {
      displayClass: "critical",
      pausePolicy: "pause_if_user_enabled",
      lane: "warning",
      severity: 85,
      dedupeKey: event.label,
    };
  }

  return {
    displayClass: isKeyEvent(event) ? "marker" : "routine",
    pausePolicy: "never",
    lane: inferEventType(event) === "warning" ? "warning" : "observation",
    severity: isKeyEvent(event) ? 45 : 10,
    dedupeKey: event.label,
  };
}

export function isPauseWorthyEvent(
  event: SimEvent,
  options: { pauseOnCriticalEvents?: boolean } = {},
): boolean {
  const classification = classifyTimelineEvent(event);
  if (classification.pausePolicy === "always_pause") return true;
  if (classification.pausePolicy === "pause_if_user_enabled") {
    return Boolean(options.pauseOnCriticalEvents);
  }
  return false;
}

export function firstPauseWorthyEventAtTick(
  events: SimEvent[],
  tick: number,
  options: { pauseOnCriticalEvents?: boolean } = {},
): SimEvent | null {
  for (const event of events) {
    if (event.tick === tick && isPauseWorthyEvent(event, options)) return event;
  }
  return null;
}

export function filterKeyEvents(events: SimEvent[]): SimEvent[] {
  return events.filter(isKeyEvent).sort((a, b) => a.tick - b.tick || a.event_id - b.event_id);
}

export function countRoutineEvents(events: SimEvent[]): number {
  return events.filter(isRoutineEvent).length;
}

export function inferEventType(
  event: SimEvent,
): "observation" | "cyber" | "kinetic" | "effect" | "movement" | "warning" {
  const haystack = `${event.type} ${event.label}`.toLowerCase();
  if (haystack.includes("cyber") || haystack.includes("attack") || haystack.includes("compromis")) {
    return "cyber";
  }
  if (haystack.includes("detect") || haystack.includes("observ") || haystack.includes("track")) {
    return "observation";
  }
  if (haystack.includes("strike") || haystack.includes("destroy") || haystack.includes("kinetic")) {
    return "kinetic";
  }
  if (haystack.includes("degrad") || haystack.includes("effect") || haystack.includes("loss")) {
    return "effect";
  }
  if (haystack.includes("move") || haystack.includes("inbound") || haystack.includes("route")) {
    return "movement";
  }
  if (haystack.includes("warn") || haystack.includes("risk") || haystack.includes("fail")) {
    return "warning";
  }
  return "observation";
}

export function formatEventTitle(event: SimEvent): string {
  return event.label.replace(/_/g, " ") || event.type;
}

export function keyEventsNearTick(events: SimEvent[], currentTick: number, limit = 6): SimEvent[] {
  const key = filterKeyEvents(events).filter((event) => event.tick <= currentTick);
  if (key.length === 0) return [];

  const windowStart = Math.max(0, currentTick - 400);
  const inWindow = key.filter((event) => event.tick >= windowStart);
  const pool = inWindow.length > 0 ? inWindow : key;
  return pool.slice(-limit);
}

export function tickPercent(tick: number, maxTick: number): number {
  if (maxTick <= 0) return 0;
  return Math.min(100, Math.max(0, (tick / maxTick) * 100));
}

export function nextKeyEventTick(
  events: SimEvent[],
  currentTick: number,
  maxTick: number,
): number | null {
  for (const event of filterKeyEvents(events)) {
    if (event.tick > currentTick && event.tick <= maxTick) {
      return event.tick;
    }
  }
  return null;
}

export function firstKeyEventAtTick(events: SimEvent[], tick: number): SimEvent | null {
  for (const event of filterKeyEvents(events)) {
    if (event.tick === tick) {
      return event;
    }
  }
  return null;
}

export function isKeyEventTick(events: SimEvent[], tick: number): boolean {
  return firstKeyEventAtTick(events, tick) != null;
}
