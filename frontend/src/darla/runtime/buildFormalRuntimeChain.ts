import type { FormalRuntimeChain, FormalRuntimeStep } from "./formalTypes";

type AnyRecord = Record<string, any>;

function arr<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function buildFormalRuntimeChain(raw: AnyRecord): FormalRuntimeChain {
  const evidence = raw?.evidence_package ?? {};
  const reasoning = raw?.reasoning_layer ?? {};
  const simulation = raw?.simulation_layer ?? {};
  const decision = raw?.decision_layer ?? {};

  const missionId =
    str(evidence.mission_id) ||
    str(reasoning.mission_id) ||
    str(raw?.scenario?.id) ||
    str(raw?.mission_id, "uas-maritime-cyber-v001");

  const currentTick = num(evidence.tick ?? raw?.tick ?? raw?.current_tick, 0);
  const replayHash =
    evidence.replay_hash ??
    simulation.replay_hash ??
    raw?.replay_hash ??
    raw?.verification?.replay_hash;

  const steps: FormalRuntimeStep[] = [];

  const observations = arr<any>(evidence.observations ?? raw?.observations ?? raw?.events).slice(-5);
  if (observations.length === 0) {
    steps.push({
      id: "observation_missing",
      kind: "observation",
      title: "No observations exported",
      summary: "Runtime events exist, but no formal observation objects are exported yet.",
      status: "warn",
    });
  } else {
    observations.forEach((o, index) => {
      steps.push({
        id: `observation_${index}`,
        kind: "observation",
        title: `Observation ${index + 1}`,
        summary: typeof o === "string" ? o : str(o.title ?? o.message ?? o.description, JSON.stringify(o)),
        tick: num(o.tick ?? o.t, currentTick),
        status: "ok",
        payload: o,
      });
    });
  }

  const beliefUpdates = arr<any>(reasoning.belief_updates ?? raw?.belief_updates);
  if (beliefUpdates.length === 0) {
    steps.push({
      id: "belief_update_missing",
      kind: "belief_update",
      title: "Belief updates not exported",
      summary: "Formal belief-state deltas should be emitted by persistent agents in the next backend pass.",
      status: "warn",
    });
  } else {
    beliefUpdates.slice(-5).forEach((b, index) => {
      const prior = num(b.prior);
      const posterior = num(b.posterior);
      steps.push({
        id: `belief_${index}`,
        kind: "belief_update",
        title: `${str(b.key, "belief")} updated`,
        summary: `${str(b.source, "agent")} changed belief from ${prior.toFixed(2)} to ${posterior.toFixed(2)}.`,
        tick: num(b.tick, currentTick),
        confidence: posterior,
        status: "ok",
        payload: b,
      });
    });
  }

  const assumptions = arr<any>(evidence.causal_assumptions ?? reasoning.causal_assumptions ?? raw?.causal_assumptions);
  if (assumptions.length === 0) {
    steps.push({
      id: "causal_assumption_missing",
      kind: "causal_assumption",
      title: "No causal assumptions exported",
      summary: "The evidence package should include the causal edges used to support or reject each COA.",
      status: "warn",
    });
  } else {
    assumptions.slice(0, 6).forEach((a, index) => {
      const confidence = num(a.confidence, 0.5);
      steps.push({
        id: `causal_${index}`,
        kind: "causal_assumption",
        title: `${str(a.source, "source")} → ${str(a.target, "target")}`,
        summary: `${str(a.relation, "causes")} with ${pct(confidence)} confidence.`,
        confidence,
        status: confidence >= 0.45 ? "ok" : "warn",
        payload: a,
      });
    });
  }

  const counterfactuals = arr<any>(evidence.counterfactual_results ?? simulation.runs ?? raw?.counterfactual_results);
  if (counterfactuals.length === 0) {
    steps.push({
      id: "counterfactual_missing",
      kind: "counterfactual",
      title: "No counterfactual runs exported",
      summary: "COA support should be based on executable intervention branches, not narrative ranking.",
      status: "blocked",
    });
  } else {
    counterfactuals.slice(0, 6).forEach((c, index) => {
      const delta = num(c.effect_delta ?? c.delta);
      steps.push({
        id: `counterfactual_${index}`,
        kind: "counterfactual",
        title: str(c.action_id, `counterfactual_${index + 1}`),
        summary: `Δ ${delta.toFixed(3)} · ${c.supports_action ? "supports action" : "does not support action"}.`,
        confidence: Math.max(0, Math.min(1, Math.abs(delta))),
        status: c.supports_action ? "ok" : "warn",
        payload: c,
      });
    });
  }

  const actions = arr<any>(evidence.candidate_actions ?? decision.candidate_actions ?? raw?.candidate_actions ?? raw?.coa_recommendations);
  actions.slice(0, 8).forEach((a, index) => {
    const gain = num(a.expected_gain ?? a.gain ?? a.utility ?? a.score);
    const risk = num(a.risk ?? a.risk_score);
    const blocked = Boolean(a.blocked) || a.status === "blocked";
    steps.push({
      id: `coa_gate_${index}`,
      kind: "coa_gate",
      title: str(a.label ?? a.name ?? a.id ?? a.action_id, `COA ${index + 1}`),
      summary: `gain ${gain.toFixed(3)} · risk ${risk.toFixed(3)}${a.authority_required ? " · authority required" : ""}`,
      confidence: gain,
      status: blocked ? "blocked" : gain > 0.05 ? "ok" : "warn",
      payload: a,
    });
  });

  const selected =
    str(evidence.selected_coa) ||
    str(decision.selected_coa) ||
    str(raw?.recommendation?.selected_coa) ||
    str(raw?.recommendation?.action_id, "hold");

  const confidence = num(evidence.confidence_score ?? decision.confidence_score ?? raw?.confidence_score);
  const caveats = arr<string>(evidence.caveats ?? decision.caveats ?? raw?.caveats);

  steps.push({
    id: "recommendation",
    kind: "recommendation",
    title: selected === "hold" ? "Hold / no action" : selected,
    summary: `Recommendation confidence ${pct(confidence)}${caveats.length ? ` · ${caveats[0]}` : ""}`,
    confidence,
    status: selected === "hold" ? "warn" : confidence >= 0.45 ? "ok" : "warn",
    payload: { selected, confidence, caveats },
  });

  return {
    missionId,
    currentTick,
    replayHash,
    steps,
    recommendation: {
      selectedCoa: selected,
      confidence,
      status: selected === "hold" ? "hold" : confidence >= 0.45 ? "recommend" : "unknown",
      caveats,
    },
  };
}
