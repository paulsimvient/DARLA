import type { BranchResult, CourseOfAction, DashboardData, RunIdentity, SimEvent } from "../types";
import type { PlaybackFrame } from "../playback";
import type { BranchOutcomeDistribution, ConfidenceBand, ModelValidityEnvelope, RuntimeCausalEdgeEvidence } from "./types";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function confidenceBand(mean: number, spread: number, evidenceCount: number): ConfidenceBand {
  const clampedMean = clamp01(mean);
  const clampedSpread = Math.max(0.01, Math.min(0.45, spread));
  return {
    mean: clampedMean,
    stddev: clampedSpread / 1.64,
    lower90: clamp01(clampedMean - clampedSpread),
    upper90: clamp01(clampedMean + clampedSpread),
    confidence: clamp01(0.42 + evidenceCount * 0.045 - clampedSpread * 0.35),
    evidenceCount,
  };
}

export type UncertaintyMetric = {
  id: string;
  label: string;
  valueLabel: string;
  band: ConfidenceBand;
  source: string;
  interpretation: string;
};

export function buildUncertaintyMetrics(
  frame: PlaybackFrame | null,
  dashboard: DashboardData | null,
  events: SimEvent[],
): UncertaintyMetric[] {
  const evidenceCount = Math.max(1, events.length);
  const missionScore = frame?.metrics?.mission_success_score ?? dashboard?.online_metrics?.mission_success_score ?? 0;
  const missionRisk = frame?.agent_beliefs?.mission_risk ?? 1 - missionScore;
  const sensorTrust = frame?.agent_beliefs?.sensor_trust ?? dashboard?.causal_debug?.beliefs.sensor_trust ?? 0.5;
  const commsHealth = frame?.agent_beliefs?.comms_health ?? dashboard?.causal_debug?.beliefs.comms_health ?? 0.5;
  const tempoRatio = frame?.agent_beliefs?.tempo_ratio ?? dashboard?.emergence?.metrics.mission_tempo_ratio ?? 1;
  const spreadBase = Math.max(0.04, 0.22 - Math.min(evidenceCount, 25) * 0.005);

  return [
    {
      id: "mission_success",
      label: "Mission success probability",
      valueLabel: `${Math.round(clamp01(missionScore) * 100)}%`,
      band: confidenceBand(missionScore, spreadBase, evidenceCount),
      source: "mission metrics + branch evidence",
      interpretation: missionScore >= 0.65 ? "Mission remains inside acceptable outcome band." : "Mission outcome is degraded or uncertain.",
    },
    {
      id: "mission_risk",
      label: "Commander mission risk",
      valueLabel: `${Math.round(clamp01(missionRisk) * 100)}%`,
      band: confidenceBand(missionRisk, spreadBase + 0.03, evidenceCount),
      source: "agent belief state",
      interpretation: missionRisk >= 0.55 ? "Risk is high enough to justify COA evaluation." : "Risk is below intervention threshold.",
    },
    {
      id: "sensor_trust",
      label: "UAS sensor trust",
      valueLabel: `${Math.round(clamp01(sensorTrust) * 100)}%`,
      band: confidenceBand(sensorTrust, spreadBase + (sensorTrust < 0.5 ? 0.04 : 0.01), evidenceCount),
      source: "sensor agent + causal monitor",
      interpretation: sensorTrust < 0.55 ? "Sensor channel is degraded; causal attribution should be checked." : "Sensor channel appears usable.",
    },
    {
      id: "comms_health",
      label: "Comms health",
      valueLabel: `${Math.round(clamp01(commsHealth) * 100)}%`,
      band: confidenceBand(commsHealth, spreadBase + 0.02, evidenceCount),
      source: "relay/comms agent",
      interpretation: commsHealth < 0.55 ? "Comms may be a competing explanation or secondary cause." : "Comms are not the dominant degradation signal.",
    },
    {
      id: "tempo_ratio",
      label: "Mission tempo ratio",
      valueLabel: `${tempoRatio.toFixed(2)}×`,
      band: confidenceBand(Math.min(1, tempoRatio / 1.5), 0.10, evidenceCount),
      source: "emergence detector",
      interpretation: tempoRatio < 0.85 ? "Tempo collapse is plausible." : "Tempo remains within expected envelope.",
    },
  ];
}

export function buildValidityEnvelopes(dashboard: DashboardData | null, scenarioPath: string): ModelValidityEnvelope[] {
  const isOpenData = scenarioPath.includes("open-data") || dashboard?.open_data?.data_mode === "open_data";
  const isFmu = scenarioPath.includes("fmu") || Boolean(dashboard?.fmu_runtime?.length);
  const weather = dashboard?.environment?.weather_summary ?? "synthetic maritime weather";

  return [
    {
      modelId: "mission-micro-world-v1",
      domain: "maritime ISR / UAS cyber disruption",
      validFor: ["small-force UAS ISR", "sensor confidence degradation", "delayed detection", "COA branch comparison"],
      notValidFor: ["kinetic effects", "large force campaign dynamics", "classified sensor performance", "real-world targeting authority"],
      assumptions: ["single primary red maritime target", "bounded UAS/relay entity count", "tick-based deterministic replay", weather],
      calibrationBasis: isOpenData ? "open_data" : "synthetic",
      confidence: isOpenData ? "medium" : "low",
    },
    {
      modelId: "runtime-causal-evidence-v1",
      domain: "event-ledger causal support scoring",
      validFor: ["temporal ordering", "state delta support", "counterfactual branch comparison", "relationship-prior weighting"],
      notValidFor: ["unobserved real-world confounder proof", "causal discovery without scenario bounds", "legal/operational attribution"],
      assumptions: ["events are timestamped consistently", "branch interventions are comparable", "edge confidence is model-derived, not ground truth"],
      calibrationBasis: "synthetic",
      confidence: "medium",
    },
    {
      modelId: isFmu ? "fmu-adapter-v1" : "analytical-stub-v1",
      domain: "co-simulation adapter",
      validFor: isFmu ? ["FMU-bound sensor stepping", "port-to-world variable bindings"] : ["analytical placeholder behavior", "UI/contract testing"],
      notValidFor: isFmu ? ["unvalidated third-party model truth"] : ["claiming real FMU execution", "hardware-accurate dynamics"],
      assumptions: isFmu ? ["FMU status is reported by runtime", "adapter emits last-step values"] : ["stub behavior stands in for external model until FMU archive is loaded"],
      calibrationBasis: isFmu ? "sme_estimate" : "synthetic",
      confidence: isFmu ? "medium" : "low",
    },
  ];
}

export type EvidenceBundlePreview = {
  runId: string;
  scenarioId: string;
  seed: string;
  replayHash: string;
  currentTick: number;
  eventCount: number;
  runtimeEdgeCount: number;
  coaCount: number;
  claimCount: number;
  credibilityCount: number;
  contents: string[];
  warnings: string[];
};

export function buildEvidenceBundlePreview(params: {
  dashboard: DashboardData | null;
  runIdentity: RunIdentity | null;
  currentTick: number;
  events: SimEvent[];
  runtimeEdges: RuntimeCausalEdgeEvidence[];
  coas: CourseOfAction[];
}): EvidenceBundlePreview {
  const { dashboard, runIdentity, currentTick, events, runtimeEdges, coas } = params;
  const warnings: string[] = [];
  if (!dashboard?.replay_hash && !runIdentity?.replay_hash) warnings.push("Replay hash not available yet.");
  if (runtimeEdges.length === 0) warnings.push("No runtime causal edges have enough support at this tick.");
  if (coas.length === 0) warnings.push("No COA recommendation is active at this tick.");
  if (dashboard?.planted_truth) warnings.push("Planted truth is present in export; use only for evaluation scoring, not runtime claims.");

  return {
    runId: runIdentity?.run_id ?? "pending-run",
    scenarioId: dashboard?.scenario_id ?? runIdentity?.scenario_id ?? "unknown-scenario",
    seed: String(dashboard?.seed ?? runIdentity?.seed ?? "—"),
    replayHash: dashboard?.replay_hash ?? runIdentity?.replay_hash ?? "—",
    currentTick,
    eventCount: events.length,
    runtimeEdgeCount: runtimeEdges.length,
    coaCount: coas.length,
    claimCount: dashboard?.claims?.length ?? 0,
    credibilityCount: dashboard?.credibility_assessments?.length ?? 0,
    contents: [
      "scenario.yaml / resolved config",
      "event_ledger.jsonl",
      "runtime_causal_edges.json",
      "coa_realism_assessments.json",
      "counterfactual_branch_summaries.json",
      "model_validity_envelopes.json",
      "replay_hash.txt",
    ],
    warnings,
  };
}

export function buildBranchOutcomeDistributions(branches: BranchResult[]): BranchOutcomeDistribution[] {
  return branches.map((branch) => {
    const missionDelta = branch.mission_delta ?? branch.branch_metrics?.mission_success_score ?? 0;
    const riskDelta = branch.risk_delta ?? 0;
    const detectionDelta = branch.detection_time_delta ?? 0;
    const evidenceCount = branch.branch_status === "completed" ? 6 : 2;
    return {
      branchId: branch.branch_id,
      label: branch.action ? `${branch.action} → ${branch.target}` : branch.branch_id,
      missionSuccessProbability: confidenceBand(0.5 + missionDelta, 0.12, evidenceCount),
      detectionTimeTicks: {
        mean: detectionDelta,
        stddev: 60,
        lower90: detectionDelta - 100,
        upper90: detectionDelta + 100,
        confidence: branch.branch_status === "completed" ? 0.72 : 0.35,
        evidenceCount,
      },
      missionScore: confidenceBand(0.5 + missionDelta, 0.10, evidenceCount),
      downsideRisk: confidenceBand(Math.max(0, -riskDelta), 0.10, evidenceCount),
    };
  });
}
