export interface CoaPathNode {
  node_id: string;
  label: string;
  type: "observation" | "inference" | "effect" | "action" | "outcome";
  confidence: number;
  tick: number;
}

export interface CoaEvidence {
  source_event_ids: number[];
  causal_edge_ids: string[];
  dominant_path: CoaPathNode[];
  falsification_summary?: string;
  replay_hash?: string;
}

export interface SimMapOverlay {
  id: string;
  tick: number;
  source: "coa" | "event" | "agent" | "fmu";
  coa_id?: number;
  entity_id?: string;
  geometry: GeoJSON.Geometry;
  style: "risk_zone" | "route" | "sensor_range" | "effect_area" | "intervention";
  label: string;
  confidence?: number;
}

export interface RunIdentity {
  run_id: string;
  branch_id: string;
  parent_run_id?: string | null;
  seed: number;
  scenario_id: string;
  current_tick: number;
  replay_hash?: string;
  authorization_mode: string;
}

export type SimulationCommand =
  | {
      type: "approve_coa";
      run_id: string;
      coa_id: number;
      action: string;
      target: string;
      scheduled_at_tick: number;
      issued_at_tick: number;
      authority: "human";
    }
  | {
      type: "reject_coa";
      run_id: string;
      coa_id: number;
      reason?: string;
    }
  | {
      type: "manual_intervention";
      run_id: string;
      action: string;
      target: string;
      requested_tick: number;
    }
  | {
      type: "continue_review";
      run_id: string;
    };

export type SimulationCommandInput =
  | Omit<Extract<SimulationCommand, { type: "approve_coa" }>, "run_id">
  | Omit<Extract<SimulationCommand, { type: "reject_coa" }>, "run_id">
  | Omit<Extract<SimulationCommand, { type: "manual_intervention" }>, "run_id">
  | Omit<Extract<SimulationCommand, { type: "continue_review" }>, "run_id">;

export interface BranchResult {
  branch_id: string;
  parent_run_id: string;
  branch_run_id?: string;
  branch_status?: string;
  branch_metrics?: MissionMetrics;
  mission_delta: number;
  detection_time_delta: number;
  risk_delta: number;
  replay_hash: string;
  from_tick?: number;
  coa_id?: number;
  action?: string;
  target?: string;
  scheduled_at_tick?: number;
}

export interface SimCommandAck {
  ok: boolean;
  message: string;
  event_id: number;
  tick: number;
  received_at: number;
  type?: string;
}

export interface CausalSubgraph {
  run_id?: string;
  nodes: CoaPathNode[];
  edges: TemporalCausalEdge[];
  evidence_events: SimEvent[];
  claims: CausalClaim[];
  credibility: CredibilityAssessment[];
}

export interface MissionMetrics {
  target_detected: boolean;
  detection_time: number;
  coa_selection_time: number;
  mission_success: boolean;
  mission_success_score: number;
  emergent_tempo_collapse: boolean;
}

export interface SimEvent {
  event_id: number;
  tick: number;
  actor: number;
  type: string;
  label: string;
  confidence: number;
  provenance: string;
  causal_parent_count: number;
  causal_parent_events?: number[];
  deltas: { field: string; before: string; after: string }[];
}

export interface TemporalCausalEdge {
  source_event_id: number;
  target_event_id: number;
  type: string;
  strength: number;
  confidence: number;
  valid_from: number;
  valid_to: number;
  stale: boolean;
  label: string;
}

export interface CausalDebugInfo {
  event_count: number;
  causal_edge_count: number;
  dominant_path_labels: string[];
  budget_limits: {
    agent_decisions_per_tick: number;
    causal_queries_per_tick: number;
    async_replay_jobs: number;
    async_branch_executions: number;
  };
  budget_total_usage: {
    agent_decisions: number;
    causal_queries: number;
    async_replay_jobs: number;
    async_branch_executions: number;
  };
  beliefs: {
    sensor_trust: number;
    sensor_degraded: boolean;
    comms_health: number;
    mission_risk: number;
    coa_entropy: number;
    causal_warning: boolean;
    credibility_valid: boolean;
  };
}

export interface CourseOfAction {
  id: number;
  proposed_tick: number;
  action: string;
  target: string;
  expected_mission_gain: number;
  causal_confidence: number;
  cost: number;
  risk: number;
  score: number;
  rationale: string;
  evidence?: CoaEvidence;
  status: string;
  scheduled_at_tick: number;
}

export interface AuthorityStatus {
  mode: string;
  pending_recommendations: number;
  active_coa_id: number;
  primary_decision_recorded: boolean;
}

export interface RelationshipEdge {
  type: string;
  source: string;
  target: string;
  component: string;
}

export interface CausalClaim {
  label: string;
  cause_variable: string;
  effect_variable: string;
  status: string;
  confidence: number;
  effect_size: number;
}

export interface CredibilityAssessment {
  label: string;
  credibility_score: number;
  reportable: boolean;
  model_name: string;
  risk_score: number;
  required_rigor: string;
  falsification_survived: boolean;
  falsification_summary: string;
  branch_outcomes: string[];
}

export interface InterventionSet {
  options: string;
  detection_time: number;
  mission_score: number;
  estimated_effect: number;
  cost: number;
  risk: number;
}

export interface MapEntity {
  id: string;
  entity_id: number;
  kind: string;
  side: string;
  has_position: boolean;
  lat: number | null;
  lon: number | null;
  alt: number | null;
  sensor_range_km: number | null;
  sensor_confidence: number | null;
  sensor_degraded: boolean;
  sensor_isolated: boolean;
}

export interface FmuPortBindingExport {
  port: string;
  world_path: string;
}

export interface FmuConfigExport {
  id: string;
  path: string;
  step_size: number;
  inputs: FmuPortBindingExport[];
  outputs: FmuPortBindingExport[];
}

export interface FmuPortRuntimeValue {
  port: string;
  value: number;
}

export interface FmuRuntimeExport {
  id: string;
  load_mode: string;
  initialized: boolean;
  last_step_time: number;
  inputs: FmuPortRuntimeValue[];
  outputs: FmuPortRuntimeValue[];
}

export interface PythonScriptExport {
  script_id: string;
  object_id: string;
  script_path: string;
  class_name: string;
  enabled: boolean;
  params: Record<string, string>;
  loaded: boolean;
  last_reload_status: string;
  last_error: string;
  last_tick: number;
  emitted_events: number;
  proposed_coas: number;
  scheduled_actions: number;
}

export interface DashboardData {
  scenario_id: string;
  seed: number;
  max_ticks: number;
  mission_cutoff: number;
  replay_hash: string;
  authorization_mode?: string;
  coa_log?: CourseOfAction[];
  baseline_metrics: MissionMetrics;
  online_metrics: MissionMetrics;
  events: SimEvent[];
  entities: MapEntity[];
  fmu_configs?: FmuConfigExport[];
  fmu_runtime?: FmuRuntimeExport[];
  python_scripts?: PythonScriptExport[];
  relationships: RelationshipEdge[];
  temporal_causal_graph?: TemporalCausalEdge[];
  causal_debug?: CausalDebugInfo;
  claims: CausalClaim[];
  credibility_assessments: CredibilityAssessment[];
  intervention_search: {
    lowest_cost_effective: InterventionSet;
    best_effective: InterventionSet;
  };
  planted_truth: {
    recovery_score: number;
    matched_edges: string[];
    missing_edges: string[];
  };
  emergence: {
    detected: boolean;
    summary: string;
    patterns: string[];
    metrics: {
      decision_latency: number;
      sensor_trust: number;
      comms_congestion: number;
      mission_tempo_ratio: number;
    };
  };
  async_validation: {
    completed: boolean;
    agent_action: string;
    falsification_survived: boolean;
    falsification_summary: string;
    lowest_cost_intervention: string;
    best_effect_intervention: string;
    planted_truth_recovery: number;
  };
  environment?: {
    theater: string;
    weather_summary: string;
    visibility_km: number;
    wind_kts: number;
    wind_direction: string;
    sea_state: number;
    weather_source: string;
  };
  open_data?: {
    data_mode: string;
    ais_tracks_path: string;
    weather_path: string;
    provenance_path: string;
    ais_track_count: number;
  };
}
