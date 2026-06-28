import type { CourseOfAction, SimEvent } from "../types";
import { coasAtTick } from "./coaHelpers";
import { formatEventTitle, isKeyEvent } from "./keyEvents";

export type EventLane = "detection" | "coa" | "causal" | "cyber" | "authority" | "execution";

export const EVENT_LANES: { id: EventLane; label: string; dotClass: string; lineClass: string }[] = [
  { id: "detection", label: "Detection", dotClass: "bg-darla-blue", lineClass: "bg-darla-blue/40" },
  { id: "coa", label: "COA", dotClass: "bg-emerald-500", lineClass: "bg-emerald-500/35" },
  { id: "causal", label: "Causal", dotClass: "bg-violet-500", lineClass: "bg-violet-500/35" },
  { id: "cyber", label: "Cyber", dotClass: "bg-purple-500", lineClass: "bg-purple-500/35" },
  { id: "authority", label: "Authority", dotClass: "bg-amber-400", lineClass: "bg-amber-400/35" },
  { id: "execution", label: "Execution", dotClass: "bg-darla-orange", lineClass: "bg-darla-orange/35" },
];

export function inferEventLane(event: SimEvent): EventLane {
  const haystack = `${event.type} ${event.label}`.toLowerCase();
  if (
    haystack.includes("coa") ||
    haystack.includes("decide") ||
    event.label.includes("coa_recommendation") ||
    event.label.includes("python_coa")
  ) {
    return "coa";
  }
  if (
    haystack.includes("approved") ||
    haystack.includes("reject") ||
    haystack.includes("authority") ||
    haystack.includes("policy")
  ) {
    return "authority";
  }
  if (haystack.includes("intervention") || haystack.includes("execut") || event.type === "InterventionApplied") {
    return "execution";
  }
  if (haystack.includes("cyber") || haystack.includes("compromis") || haystack.includes("jam")) {
    return "cyber";
  }
  if (
    haystack.includes("causal") ||
    haystack.includes("monitor") ||
    haystack.includes("emergent") ||
    haystack.includes("confound")
  ) {
    return "causal";
  }
  if (haystack.includes("detect") || haystack.includes("target") || haystack.includes("track")) {
    return "detection";
  }
  return "causal";
}

export function laneMeta(lane: EventLane) {
  return EVENT_LANES.find((entry) => entry.id === lane) ?? EVENT_LANES[2];
}

export function eventsForLane(events: SimEvent[], lane: EventLane): SimEvent[] {
  return events.filter((event) => isKeyEvent(event) && inferEventLane(event) === lane);
}

export function relatedCoasForEvent(
  event: SimEvent,
  coaLog: CourseOfAction[] | undefined,
): CourseOfAction[] {
  if (!coaLog?.length) return [];
  const atTick = coasAtTick(coaLog, event.tick);
  if (atTick.length > 0) return atTick.slice(0, 3);

  return coaLog
    .filter((coa) => Math.abs(coa.proposed_tick - event.tick) <= 120)
    .sort((a, b) => Math.abs(a.proposed_tick - event.tick) - Math.abs(b.proposed_tick - event.tick))
    .slice(0, 3);
}

export function eventStateChanges(event: SimEvent): { field: string; before: string; after: string }[] {
  return event.deltas.filter((delta) => delta.before !== delta.after);
}

export function eventImplications(
  event: SimEvent,
  missionCutoff: number,
): string[] {
  const implications: string[] = [];
  const changes = eventStateChanges(event);

  for (const delta of changes) {
    if (delta.field.includes("detected") && delta.after === "true") {
      if (event.tick > missionCutoff) {
        implications.push("Target detection occurred after the mission decision cutoff.");
      } else {
        implications.push("Target detection occurred within the decision window.");
      }
    }
    if (delta.field.includes("confidence") || delta.field.includes("degraded")) {
      implications.push("Sensor or track confidence changed — review related COAs for isolation or search.");
    }
    if (delta.field.includes("comms") || delta.field.includes("packet_loss")) {
      implications.push("Comms path degraded — relay restoration may be required before further tasking.");
    }
  }

  const haystack = `${event.type} ${event.label}`.toLowerCase();
  if (haystack.includes("coa") || haystack.includes("decide")) {
    implications.push("Command decision point — approval may schedule an intervention branch.");
  }
  if (haystack.includes("emergent") || haystack.includes("tempo")) {
    implications.push("Emergent operational pattern detected — mission tempo may be collapsing.");
  }
  if (event.tick > missionCutoff && !implications.some((line) => line.includes("cutoff"))) {
    implications.push("Past execution window — new approvals create a what-if branch, not baseline history.");
  }

  const unique = [...new Set(implications)];
  return unique.length > 0 ? unique : ["Review causal trace and map overlays for downstream effects."];
}

export function eventSummaryLine(event: SimEvent): string {
  const delta = eventStateChanges(event)[0];
  if (delta) {
    const field = delta.field.split(".").pop() ?? delta.field;
    return `${field}: ${delta.before} → ${delta.after}`;
  }
  return formatEventTitle(event);
}
