import type { CausalClaim, CourseOfAction, CredibilityAssessment, RelationshipEdge, SimEvent, TemporalCausalEdge } from "../types";

export type ConfidenceBand = {
  mean: number;
  stddev: number;
  lower90: number;
  upper90: number;
  confidence: number;
  evidenceCount: number;
};

export type ModelValidityEnvelope = {
  domain: string;
  modelId: string;
  validFor: string[];
  notValidFor: string[];
  assumptions: string[];
  calibrationBasis: "synthetic" | "open_data" | "sme_estimate" | "classified_proxy" | "unknown";
  confidence: "low" | "medium" | "high";
};

export type RuntimeCausalEdgeEvidence = {
  source: string;
  target: string;
  temporalPrecedence: number;
  stateDeltaSupport: number;
  interventionContrast: number;
  counterfactualSupport: number;
  relationshipPrior: number;
  falsificationSurvival: number;
  confoundingPenalty: number;
  totalScore: number;
  supportingEventIds: number[];
  explanation: string;
};

export type EstimandSpec = {
  id: string;
  treatment: string;
  outcome: string;
  direction: "positive" | "negative" | "unknown";
  minimumEffectSize: number;
  allowedAdjustments: string[];
  partialIdentificationAllowed: boolean;
};

export type BranchOutcomeDistribution = {
  branchId: string;
  label: string;
  missionSuccessProbability: ConfidenceBand;
  detectionTimeTicks: ConfidenceBand;
  missionScore: ConfidenceBand;
  downsideRisk: ConfidenceBand;
};

export type CoaRealismAssessment = {
  coa: CourseOfAction;
  expectedMissionGain: ConfidenceBand;
  timeToEffectTicks: ConfidenceBand;
  authoritySatisfied: boolean;
  preconditionsSatisfied: boolean;
  majorRisks: string[];
  recommendedDisposition: "recommend" | "hold" | "abstain" | "escalate";
  rationale: string;
};

export type EvidenceBackedCausalMap = {
  relationships: RelationshipEdge[];
  eventEdges: TemporalCausalEdge[];
  runtimeEdges: RuntimeCausalEdgeEvidence[];
  sourceEvents: SimEvent[];
  validity: ModelValidityEnvelope[];
};

export type RunUncertaintyMetric = {
  id: string;
  label: string;
  valueLabel: string;
  band: ConfidenceBand;
  source: string;
  interpretation: string;
};

export type RunEvidenceBundlePreview = {
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

export type RunEvidenceSummary = {
  runId: string;
  scenarioId: string;
  seed: number;
  replayHash: string | null;
  authorizationMode: string;
  status: string;
  currentTick: number;
  generatedAt: string;
  source: "run_api" | "derived";
  runtimeCausalEdges: RuntimeCausalEdgeEvidence[];
  causalClaims: CausalClaim[];
  credibilityAssessments: CredibilityAssessment[];
  coaGateResults: CoaRealismAssessment[];
  branchComparisons: BranchOutcomeDistribution[];
  uncertaintyBands: RunUncertaintyMetric[];
  validityEnvelope: ModelValidityEnvelope[];
  evidenceBundle: RunEvidenceBundlePreview;
  rawCounts: {
    frames: number;
    events: number;
    commands: number;
    branches: number;
    droppedSseBlocks: number;
  };
};

export type EvidenceBundleManifest = {
  manifest_version: string;
  generated_at: string;
  run: {
    run_id: string;
    scenario_id: string;
    seed: number;
    replay_hash: string | null;
    authorization_mode: string;
    status: string;
    current_tick: number;
  };
  contents: string[];
  warnings: string[];
  runtime_causal_edges: RuntimeCausalEdgeEvidence[];
  causal_claims: CausalClaim[];
  credibility_assessments: CredibilityAssessment[];
  coa_gate_results: CoaRealismAssessment[];
  branch_comparisons: BranchOutcomeDistribution[];
  uncertainty_bands: RunUncertaintyMetric[];
  validity_envelope: ModelValidityEnvelope[];
  raw_counts: RunEvidenceSummary["rawCounts"];
};
