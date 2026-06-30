import type { RelationshipEdge, SimEvent, TemporalCausalEdge } from "../types";
import type { RuntimeCausalEdgeEvidence } from "./types";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function textOf(event: SimEvent): string {
  return `${event.type} ${event.label} ${event.deltas.map((d) => `${d.field}:${d.before}->${d.after}`).join(" ")}`.toLowerCase();
}

function relationshipPrior(source: string, target: string, relationships: RelationshipEdge[]): number {
  const direct = relationships.some((edge) => edge.source === source && edge.target === target);
  const reverse = relationships.some((edge) => edge.source === target && edge.target === source);
  if (direct) return 0.8;
  if (reverse) return 0.35;
  return 0.1;
}

function inferVariable(event: SimEvent): string {
  const label = event.label.toLowerCase();
  if (label.includes("cyber")) return "red_cyber_actor.cyber_effect";
  if (label.includes("sensor")) return "blue_uas_1.sensor.confidence";
  if (label.includes("detect") || label.includes("target")) return "detection_time";
  if (label.includes("mission")) return "mission_success_score";
  if (label.includes("coa") || label.includes("decision")) return "commander.coa_decision";
  return event.deltas[0]?.field ?? event.label;
}

export function buildRuntimeCausalEvidence(
  events: SimEvent[],
  temporalEdges: TemporalCausalEdge[],
  relationships: RelationshipEdge[],
): RuntimeCausalEdgeEvidence[] {
  const byId = new Map(events.map((event) => [event.event_id, event]));
  const evidence = new Map<string, RuntimeCausalEdgeEvidence>();

  for (const edge of temporalEdges) {
    const sourceEvent = byId.get(edge.source_event_id);
    const targetEvent = byId.get(edge.target_event_id);
    if (!sourceEvent || !targetEvent) continue;

    const source = inferVariable(sourceEvent);
    const target = inferVariable(targetEvent);
    if (source === target) continue;

    const key = `${source}->${target}`;
    const sourceText = textOf(sourceEvent);
    const targetText = textOf(targetEvent);
    const interventionContrast = sourceText.includes("intervention") || sourceText.includes("isolate") ? 0.65 : 0.15;
    const counterfactualSupport = sourceText.includes("coa") || targetText.includes("mission") ? 0.45 : 0.2;
    const stateDeltaSupport = targetEvent.deltas.length > 0 ? 0.65 : 0.2;
    const temporalPrecedence = targetEvent.tick >= sourceEvent.tick ? 0.85 : 0.0;
    const relPrior = relationshipPrior(String(sourceEvent.actor), String(targetEvent.actor), relationships);
    const falsificationSurvival = edge.stale ? 0.35 : 0.65;
    const confoundingPenalty = targetText.includes("weather") || targetText.includes("logistics") ? 0.25 : 0.05;
    const totalScore = clamp01(
      0.18 * temporalPrecedence +
        0.18 * stateDeltaSupport +
        0.22 * interventionContrast +
        0.18 * counterfactualSupport +
        0.10 * relPrior +
        0.14 * falsificationSurvival -
        0.20 * confoundingPenalty,
    );

    const prior = evidence.get(key);
    const next: RuntimeCausalEdgeEvidence = {
      source,
      target,
      temporalPrecedence,
      stateDeltaSupport,
      interventionContrast,
      counterfactualSupport,
      relationshipPrior: relPrior,
      falsificationSurvival,
      confoundingPenalty,
      totalScore,
      supportingEventIds: [sourceEvent.event_id, targetEvent.event_id],
      explanation:
        totalScore >= 0.65
          ? "Runtime evidence supports a plausible causal edge."
          : "Candidate edge needs more intervention/counterfactual support.",
    };

    if (!prior || next.totalScore > prior.totalScore) {
      evidence.set(key, next);
    } else {
      prior.supportingEventIds = Array.from(new Set([...prior.supportingEventIds, ...next.supportingEventIds]));
    }
  }

  return [...evidence.values()].sort((a, b) => b.totalScore - a.totalScore);
}
