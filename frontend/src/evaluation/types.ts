export type EvalStatus = "pass" | "watch" | "fail" | "not_run";

export type EvalMetric = {
  id: string;
  label: string;
  value: number;
  unit?: string;
  target?: string;
  status: EvalStatus;
  interpretation: string;
};

export type ChallengeScenario = {
  id: string;
  label: string;
  file: string;
  description: string;
  expectedOutcome: string;
  expectedBehavior: "recommend" | "abstain" | "escalate" | "reject_unsafe";
  primaryConfounder?: string;
  hiddenTruthAvailable: boolean;
  executable: boolean;
};

export type ChallengeScenarioResult = ChallengeScenario & {
  status: EvalStatus;
  causalPrecision: number;
  causalRecall: number;
  correctCoa: boolean;
  properAbstention: boolean;
  unsafeRecommendation: boolean;
  evidenceNotes: string[];
};

export type CausalRecoverySummary = {
  truthAccess: "hidden_from_runtime" | "runtime_may_access_truth" | "unknown";
  expectedEdges: string[];
  acceptedRuntimeEdges: string[];
  truePositiveEdges: string[];
  falsePositiveEdges: string[];
  missedEdges: string[];
  precision: number;
  recall: number;
  falseCausalClaimRate: number;
};

export type CoaEvaluationSummary = {
  recommendedActions: string[];
  correctCoaRate: number;
  unsafeCoaRate: number;
  properAbstentionRate: number;
  humanReviewRate: number;
  notes: string[];
};

export type EvidenceBundleScore = {
  score: number;
  status: EvalStatus;
  requiredArtifacts: string[];
  presentArtifacts: string[];
  missingArtifacts: string[];
  warnings: string[];
};

export type ReproducibilitySummary = {
  replayHashPresent: boolean;
  droppedSseBlocks: number;
  deterministicReplayStatus: EvalStatus;
  notes: string[];
};

export type EvaluationReport = {
  reportId: string;
  generatedAt: string;
  runId: string | null;
  scenarioId: string;
  seed: number | null;
  evaluationMode: "single_run" | "blind_pack";
  scenarioPackId?: string;
  summaryStatus: EvalStatus;
  readinessScore: number;
  metrics: EvalMetric[];
  causalRecovery: CausalRecoverySummary;
  coaEvaluation: CoaEvaluationSummary;
  evidenceBundle: EvidenceBundleScore;
  reproducibility: ReproducibilitySummary;
  challengeResults: ChallengeScenarioResult[];
  recommendations: string[];
};

export type ScenarioPackManifest = {
  packId: string;
  label: string;
  description: string;
  scenarios: ChallengeScenario[];
};
