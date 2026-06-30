import type { SimEvent } from "../types";

export type TimelineDisplayClass = "routine" | "marker" | "major" | "critical";
export type TimelinePausePolicy = "never" | "notify_only" | "pause_if_user_enabled" | "always_pause";
export type TimelineEventLane = "cyber" | "causal" | "coa" | "authority" | "execution" | "observation" | "warning";

export type TimelineEventClassification = {
  displayClass: TimelineDisplayClass;
  pausePolicy: TimelinePausePolicy;
  lane: TimelineEventLane;
  severity: number;
  dedupeKey: string;
  explanation: string;
};

const ROUTINE_PATTERNS = [
  /^fmu_step:/,
  /_monitoring$/,
  /^credibility_monitoring$/,
  /^sensor_agent_monitoring$/,
  /^causal_monitor_monitoring$/,
  /^commander_monitoring$/,
  /^red_cyber_monitoring$/,
];

export function isRoutineTimelineEvent(event: SimEvent): boolean {
  return ROUTINE_PATTERNS.some((pattern) => pattern.test(event.label));
}

function deltaAfter(event: SimEvent, field: string): string {
  return event.deltas.find((delta) => delta.field === field)?.after ?? "";
}

export function classifyTimelineEvent(event: SimEvent): TimelineEventClassification {
  const label = event.label.toLowerCase();
  const type = event.type.toLowerCase();
  const text = `${type} ${label}`;

  if (event.label === "review_hold") {
    return {
      displayClass: "critical",
      pausePolicy: "always_pause",
      lane: "authority",
      severity: 95,
      dedupeKey: `review_hold:${event.tick}`,
      explanation: "Human COA review hold.",
    };
  }

  if (event.label === "online_agent_decision") {
    return {
      displayClass: "critical",
      pausePolicy: "pause_if_user_enabled",
      lane: "authority",
      severity: 90,
      dedupeKey: `decision:${deltaAfter(event, "agent.selected_action")}`,
      explanation: "Autonomous commander decision.",
    };
  }

  if (event.label === "coa_recommendation" || event.label === "coa_recommendation_changed") {
    return {
      displayClass: "major",
      pausePolicy: "notify_only",
      lane: "coa",
      severity: 70,
      dedupeKey: `coa:${deltaAfter(event, "coa.rank.1.action")}:${deltaAfter(event, "coa.rank.1.target")}`,
      explanation: "COA recommendation available; not a playback stop.",
    };
  }

  if (event.label === "coa_recommendation_digest") {
    return {
      displayClass: "routine",
      pausePolicy: "never",
      lane: "coa",
      severity: 25,
      dedupeKey: `coa_digest:${event.tick}`,
      explanation: "Periodic COA digest; compressed by default.",
    };
  }

  if (label.includes("causal_monitor_warning") || text.includes("causal warning")) {
    return {
      displayClass: "major",
      pausePolicy: "notify_only",
      lane: "causal",
      severity: 75,
      dedupeKey: `causal_warning:${deltaAfter(event, "causal.patterns")}`,
      explanation: "Causal warning; show evidence but do not stop timeline.",
    };
  }

  if (text.includes("cyber") || text.includes("degrad")) {
    return {
      displayClass: "critical",
      pausePolicy: "pause_if_user_enabled",
      lane: "cyber",
      severity: 85,
      dedupeKey: `cyber:${event.label}`,
      explanation: "Cyber/degradation event.",
    };
  }

  if (text.includes("intervention") || text.includes("approved") || text.includes("applied")) {
    return {
      displayClass: "major",
      pausePolicy: "notify_only",
      lane: "execution",
      severity: 70,
      dedupeKey: `execution:${event.label}`,
      explanation: "Intervention/execution marker.",
    };
  }

  if (text.includes("detect") || text.includes("target")) {
    return {
      displayClass: "major",
      pausePolicy: "notify_only",
      lane: "observation",
      severity: 65,
      dedupeKey: `detect:${event.label}`,
      explanation: "Detection/observation marker.",
    };
  }

  if (isRoutineTimelineEvent(event)) {
    return {
      displayClass: "routine",
      pausePolicy: "never",
      lane: "observation",
      severity: 5,
      dedupeKey: `routine:${event.label}`,
      explanation: "Routine monitoring event.",
    };
  }

  return {
    displayClass: event.type === "Observe" ? "marker" : "major",
    pausePolicy: "never",
    lane: event.type === "Observe" ? "observation" : "warning",
    severity: event.type === "Observe" ? 35 : 55,
    dedupeKey: `${event.type}:${event.label}`,
    explanation: "Timeline marker.",
  };
}

export function shouldPauseForEvent(
  event: SimEvent,
  options: { pauseOnCriticalEvents: boolean; humanReviewMode: boolean },
): boolean {
  const c = classifyTimelineEvent(event);
  if (c.pausePolicy === "always_pause") return options.humanReviewMode;
  if (c.pausePolicy === "pause_if_user_enabled") return options.pauseOnCriticalEvents;
  return false;
}
