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
