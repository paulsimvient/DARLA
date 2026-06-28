import type { SimEvent } from "../types";
import { filterKeyEvents } from "./keyEvents";

export type TimelineMomentKind =
  | "causal_warning"
  | "coa_review"
  | "detection"
  | "authority"
  | "cyber";

export type TimelineMoment = {
  event: SimEvent;
  kind: TimelineMomentKind;
  label: string;
};

function momentKindForEvent(event: SimEvent): TimelineMomentKind | null {
  const text = `${event.label} ${event.type}`.toLowerCase();
  if (text.includes("causal") && text.includes("warning")) return "causal_warning";
  if (text.includes("coa_recommendation") || text.startsWith("python_coa:")) return "coa_review";
  if (text.includes("detect")) return "detection";
  if (text.includes("human_") || text.includes("approved") || text.includes("rejected")) return "authority";
  if (text.includes("cyber") || text.includes("degrad")) return "cyber";
  return null;
}

export function detectTimelineMoments(events: SimEvent[]): TimelineMoment[] {
  const moments: TimelineMoment[] = [];
  const seenCoaTicks = new Set<number>();

  for (const event of filterKeyEvents(events)) {
    const kind = momentKindForEvent(event);
    if (!kind) continue;
    if (kind === "coa_review") {
      if (seenCoaTicks.has(event.tick)) continue;
      seenCoaTicks.add(event.tick);
    }
    moments.push({
      event,
      kind,
      label: event.label.replace(/_/g, " ") || event.type,
    });
  }

  return moments.sort((a, b) => a.event.tick - b.event.tick || a.event.event_id - b.event.event_id);
}

export function momentPinClass(kind: TimelineMomentKind): string {
  switch (kind) {
    case "causal_warning":
      return "bg-red-500 ring-red-300/40";
    case "coa_review":
      return "bg-blue-500 ring-blue-300/40";
    case "detection":
      return "bg-amber-400 ring-amber-200/40";
    case "authority":
      return "bg-emerald-500 ring-emerald-300/40";
    case "cyber":
      return "bg-rose-500 ring-rose-300/40";
  }
}
