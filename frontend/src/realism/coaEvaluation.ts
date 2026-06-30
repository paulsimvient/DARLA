import type { CourseOfAction } from "../types";
import type { CoaRealismAssessment, ConfidenceBand } from "./types";

function band(mean: number, spread: number, evidenceCount: number): ConfidenceBand {
  return {
    mean,
    stddev: spread / 1.64,
    lower90: mean - spread,
    upper90: mean + spread,
    confidence: Math.max(0, Math.min(1, 0.45 + evidenceCount * 0.08 - spread * 0.2)),
    evidenceCount,
  };
}

export function assessCoaRealism(coas: CourseOfAction[]): CoaRealismAssessment[] {
  return coas.map((coa) => {
    const evidenceCount = coa.evidence?.source_event_ids?.length ?? 0;
    const uncertaintySpread = Math.max(0.04, 0.18 - evidenceCount * 0.02 + coa.risk * 0.08);
    const authoritySatisfied = coa.status === "approved" || coa.status === "executing" || coa.status === "completed";
    const preconditionsSatisfied = coa.score > 0.25 && coa.causal_confidence > 0.35;
    const majorRisks: string[] = [];
    if (coa.risk > 0.45) majorRisks.push("High operational downside risk.");
    if (coa.causal_confidence < 0.55) majorRisks.push("Causal support is weak; consider abstention or additional sensing.");
    if (coa.cost > 0.65) majorRisks.push("High resource/time cost.");

    let recommendedDisposition: CoaRealismAssessment["recommendedDisposition"] = "recommend";
    if (!preconditionsSatisfied) recommendedDisposition = "abstain";
    else if (!authoritySatisfied && coa.score > 0.6) recommendedDisposition = "escalate";
    else if (coa.risk > coa.expected_mission_gain) recommendedDisposition = "hold";

    return {
      coa,
      expectedMissionGain: band(coa.expected_mission_gain, uncertaintySpread, evidenceCount),
      timeToEffectTicks: band(Math.max(30, coa.scheduled_at_tick - coa.proposed_tick), 90, evidenceCount),
      authoritySatisfied,
      preconditionsSatisfied,
      majorRisks,
      recommendedDisposition,
      rationale:
        recommendedDisposition === "abstain"
          ? "Insufficient causal support or unmet preconditions."
          : recommendedDisposition === "escalate"
            ? "Operationally promising but authority is not yet satisfied."
            : recommendedDisposition === "hold"
              ? "Potential benefit exists, but downside risk exceeds expected gain."
              : "COA is supported by current causal evidence and operational constraints.",
    };
  });
}
