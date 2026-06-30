import type { BranchResult, CausalSubgraph, DashboardData, MissionMetrics, RunIdentity, SimulationCommandInput } from "./types";
import type { PlaybackData } from "./playback";
import type { EvidenceBundleManifest, RunEvidenceSummary } from "./realism/types";
import type { EvaluationReport, ScenarioPackManifest } from "./evaluation/types";

export interface PlaybackRequestOptions {
  scenario: string;
  seed: number;
  authorizationMode?: string;
  approvals?: string[];
}

export interface CreateRunOptions {
  scenario: string;
  seed: number;
  authorizationMode?: string;
  branchId?: string;
  parentRunId?: string | null;
}

export interface RunRecord extends RunIdentity {
  status: string;
}

export interface RunStatus extends RunIdentity {
  status: string;
  metrics?: MissionMetrics | null;
  branches?: BranchResult[];
}

export async function fetchRunStatus(runId: string): Promise<RunStatus> {
  const response = await fetch(`/api/runs/${runId}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Run status failed (${response.status})`);
  }
  return response.json();
}

export async function fetchRunBranches(runId: string): Promise<{ branches: BranchResult[] }> {
  const response = await fetch(`/api/runs/${runId}/branches`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Branch list failed (${response.status})`);
  }
  return response.json();
}

export async function createRun(options: CreateRunOptions): Promise<RunRecord> {
  const response = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scenario: options.scenario,
      seed: options.seed,
      authorization_mode: options.authorizationMode ?? "policy_auto",
      branch_id: options.branchId,
      parent_run_id: options.parentRunId,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Create run failed (${response.status})`);
  }
  return response.json();
}

export function runStreamUrl(runId: string): string {
  return `/api/runs/${runId}/stream`;
}

export async function sendRunCommand(runId: string, command: SimulationCommandInput): Promise<{ accepted: boolean }> {
  const response = await fetch(`/api/runs/${runId}/commands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...command, run_id: runId }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Command failed (${response.status})`);
  }
  return response.json();
}

export async function createBranch(
  runId: string,
  body: {
    from_tick: number;
    intervention: { action: string; target: string; scheduled_at_tick: number };
  },
) {
  const response = await fetch(`/api/runs/${runId}/branches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Branch failed (${response.status})`);
  }
  return response.json() as Promise<BranchResult>;
}

export async function fetchRunCoas(runId: string) {
  const response = await fetch(`/api/runs/${runId}/coas`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `COA fetch failed (${response.status})`);
  }
  return response.json();
}

export async function fetchCausalSubgraph(runId: string, params: { coa_id?: number; event_id?: number; entity?: string }) {
  const search = new URLSearchParams();
  if (params.coa_id != null) search.set("coa_id", String(params.coa_id));
  if (params.event_id != null) search.set("event_id", String(params.event_id));
  if (params.entity) search.set("entity", params.entity);
  const response = await fetch(`/api/runs/${runId}/causal-subgraph?${search}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Causal subgraph failed (${response.status})`);
  }
  return response.json() as Promise<CausalSubgraph>;
}

export async function fetchDashboard(
  scenario: string,
  seed: number,
  options: { authorizationMode?: string; approvals?: string[] } = {},
): Promise<DashboardData> {
  const params = new URLSearchParams({ scenario, seed: String(seed) });
  if (options.authorizationMode) {
    params.set("mode", options.authorizationMode);
  }
  for (const approval of options.approvals ?? []) {
    params.append("approve", approval);
  }
  const response = await fetch(`/api/dashboard?${params}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }
  return response.json();
}

export async function fetchPlayback(options: PlaybackRequestOptions): Promise<PlaybackData> {
  const params = new URLSearchParams({
    scenario: options.scenario,
    seed: String(options.seed),
  });
  if (options.authorizationMode) {
    params.set("mode", options.authorizationMode);
  }
  for (const approval of options.approvals ?? []) {
    params.append("approve", approval);
  }
  const response = await fetch(`/api/playback?${params}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Playback request failed (${response.status})`);
  }
  return response.json();
}

export function livePlaybackUrl(options: PlaybackRequestOptions): string {
  const params = new URLSearchParams({
    scenario: options.scenario,
    seed: String(options.seed),
  });
  if (options.authorizationMode) {
    params.set("mode", options.authorizationMode);
  }
  for (const approval of options.approvals ?? []) {
    params.append("approve", approval);
  }
  return `/api/live?${params}`;
}

export async function fetchEditorScripts() {
  const response = await fetch("/api/editor/scripts");
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Script list failed (${response.status})`);
  }
  return response.json();
}

export async function fetchEditorScript(scriptId: string) {
  const response = await fetch(`/api/editor/scripts/${encodeURIComponent(scriptId)}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Script fetch failed (${response.status})`);
  }
  return response.json();
}

export async function saveEditorScriptSource(scriptId: string, source: string) {
  const response = await fetch(`/api/editor/scripts/${encodeURIComponent(scriptId)}/source`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Script save failed (${response.status})`);
  }
  return response.json();
}

export async function reloadEditorScript(scriptId: string) {
  const response = await fetch(`/api/editor/scripts/${encodeURIComponent(scriptId)}/reload`, {
    method: "POST",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Script reload failed (${response.status})`);
  }
  return response.json();
}

export async function runEditorScriptOneTick(scriptId: string) {
  const response = await fetch(`/api/editor/scripts/${encodeURIComponent(scriptId)}/run-one-tick`, {
    method: "POST",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Script tick failed (${response.status})`);
  }
  return response.json();
}

export async function fetchProvenance(scenario: string) {
  const response = await fetch(`/api/provenance?scenario=${encodeURIComponent(scenario)}`);
  if (!response.ok) {
    return null;
  }
  return response.json();
}

export async function fetchRunEvidence(runId: string): Promise<RunEvidenceSummary> {
  const response = await fetch(`/api/runs/${runId}/evidence`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Run evidence failed (${response.status})`);
  }
  return response.json();
}

export async function fetchRunCoaGates(runId: string): Promise<{ run_id: string; coa_gate_results: RunEvidenceSummary["coaGateResults"] }> {
  const response = await fetch(`/api/runs/${runId}/coa-gates`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `COA gates failed (${response.status})`);
  }
  return response.json();
}

export async function fetchRunCausalClaims(runId: string): Promise<{
  run_id: string;
  claims: RunEvidenceSummary["causalClaims"];
  credibility_assessments: RunEvidenceSummary["credibilityAssessments"];
  planted_truth?: unknown;
  warning?: string | null;
}> {
  const response = await fetch(`/api/runs/${runId}/causal-claims`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Causal claims failed (${response.status})`);
  }
  return response.json();
}

export async function fetchEvidenceBundleManifest(runId: string): Promise<EvidenceBundleManifest> {
  const response = await fetch(`/api/runs/${runId}/evidence-bundle`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Evidence bundle failed (${response.status})`);
  }
  return response.json();
}

export function evidenceBundleDownloadUrl(runId: string): string {
  return `/api/runs/${runId}/evidence-bundle?download=1`;
}



export async function fetchRunEvaluation(runId: string): Promise<EvaluationReport> {
  const response = await fetch(`/api/runs/${runId}/evaluation`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Run evaluation failed (${response.status})`);
  }
  return response.json();
}

export async function fetchEvaluationScenarioPack(): Promise<ScenarioPackManifest> {
  const response = await fetch("/api/eval/scenario-pack");
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Scenario pack fetch failed (${response.status})`);
  }
  return response.json();
}

export async function runBlindPackEvaluation(options: { runId: string; seeds?: number[] }): Promise<EvaluationReport> {
  const response = await fetch("/api/eval/blind-pack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ run_id: options.runId, seeds: options.seeds ?? [] }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Blind pack evaluation failed (${response.status})`);
  }
  return response.json();
}
