export function arr<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export function pct(value: unknown): string {
  return `${Math.round(num(value, 0) * 100)}%`;
}

export function getEvidence(data: Record<string, any>) {
  return data?.evidence_package ?? {};
}

export function getSelectedCoa(data: Record<string, any>): string {
  const evidence = getEvidence(data);
  return (
    evidence.selected_coa ||
    data?.decision_layer?.selected_coa ||
    data?.recommendation?.selected_coa ||
    data?.recommendation?.action_id ||
    data?.selected_coa ||
    "hold"
  );
}

export function getConfidence(data: Record<string, any>): number {
  const evidence = getEvidence(data);
  return num(
    evidence.confidence_score ??
      data?.decision_layer?.confidence_score ??
      data?.recommendation?.confidence_score ??
      data?.confidence_score,
    0
  );
}

export function getCandidateActions(data: Record<string, any>): any[] {
  const evidence = getEvidence(data);
  return arr<any>(
    evidence.candidate_actions ??
      data?.decision_layer?.candidate_actions ??
      data?.coa_gates ??
      data?.coa_recommendations ??
      data?.coas ??
      data?.candidate_actions
  );
}

export function getCounterfactuals(data: Record<string, any>): any[] {
  const evidence = getEvidence(data);
  return arr<any>(
    evidence.counterfactual_results ??
      data?.simulation_layer?.runs ??
      data?.counterfactual_results ??
      data?.counterfactuals
  );
}

export function getCausalEdges(data: Record<string, any>): any[] {
  const evidence = getEvidence(data);
  return arr<any>(
    evidence.causal_assumptions ??
      data?.reasoning_layer?.causal_assumptions ??
      data?.causal_assumptions ??
      data?.causal_edges ??
      data?.graph?.edges
  );
}

export function getEvents(data: Record<string, any>): any[] {
  const evidence = getEvidence(data);
  return arr<any>(evidence.observations ?? data?.events ?? data?.observations);
}
