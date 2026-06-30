export type ConfidenceBand = "low" | "medium" | "high";

export interface BeliefUpdate {
  tick: number;
  source: string;
  key: string;
  prior: number;
  posterior: number;
  rationale: string;
}

export interface CausalAssumption {
  source: string;
  target: string;
  relation: string;
  confidence: number;
}

export interface CandidateAction {
  id: string;
  label: string;
  expected_gain: number;
  risk: number;
  authority_required: boolean;
}

export interface CounterfactualSummary {
  action_id: string;
  baseline_outcome: string;
  intervention_outcome: string;
  effect_delta: number;
  supports_action: boolean;
}

export interface EvidencePackage {
  mission_id: string;
  tick: number;
  observations: string[];
  causal_assumptions: CausalAssumption[];
  candidate_actions: CandidateAction[];
  counterfactual_results: CounterfactualSummary[];
  selected_coa: string;
  confidence_score: number;
  confidence_band: ConfidenceBand;
  caveats: string[];
  replay_hash: number | string;
}

export interface ReasoningLayerExport {
  mission_id: string;
  objective?: string;
  belief_updates: BeliefUpdate[];
  causal_assumptions: CausalAssumption[];
  uncertainty_notes?: string[];
}

export interface SimulationLayerExport {
  active_backend: "internal" | "counterfactual" | "fmu" | "distributed";
  runs: CounterfactualSummary[];
  replay_hash?: number | string;
}

export interface DecisionLayerExport {
  candidate_actions: CandidateAction[];
  selected_coa: string;
  confidence_score: number;
  confidence_band: ConfidenceBand;
  caveats: string[];
}

export interface PhaseGDashboardExport {
  reasoning_layer: ReasoningLayerExport;
  simulation_layer: SimulationLayerExport;
  decision_layer: DecisionLayerExport;
  evidence_package: EvidencePackage;
}
