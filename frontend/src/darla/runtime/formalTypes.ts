export type FormalStepKind =
  | "observation"
  | "belief_update"
  | "causal_assumption"
  | "counterfactual"
  | "coa_gate"
  | "evidence_package"
  | "recommendation";

export type FormalStepStatus = "ok" | "warn" | "blocked" | "unknown";

export interface FormalRuntimeStep {
  id: string;
  kind: FormalStepKind;
  title: string;
  summary: string;
  tick?: number;
  confidence?: number;
  status: FormalStepStatus;
  sourceRefs?: string[];
  payload?: unknown;
}

export interface FormalRuntimeChain {
  missionId: string;
  currentTick?: number;
  replayHash?: string | number;
  steps: FormalRuntimeStep[];
  recommendation: {
    selectedCoa: string;
    confidence: number;
    status: "recommend" | "hold" | "blocked" | "unknown";
    caveats: string[];
  };
}
