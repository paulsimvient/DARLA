#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[Phase G] Applying formal Mission Reasoning integration from: $ROOT"

if [[ ! -d "$ROOT/sim-reasoning" ]]; then
  echo "ERROR: sim-reasoning/ not found. First unzip darla_phase_g_rebuild.zip into the repo root."
  exit 1
fi

if [[ ! -f "$ROOT/CMakeLists.txt" ]]; then
  echo "ERROR: CMakeLists.txt not found. Run from the DARLA repo root."
  exit 1
fi

echo "[Phase G] Backing up CMakeLists.txt -> CMakeLists.txt.phaseg.bak"
cp "$ROOT/CMakeLists.txt" "$ROOT/CMakeLists.txt.phaseg.bak"

python3 "$ROOT/scripts/patch-phase-g-cmake.py" "$ROOT/CMakeLists.txt"

echo "[Phase G] Creating dashboard adapter files"
mkdir -p "$ROOT/frontend/src/darla/phaseG"

cat > "$ROOT/frontend/src/darla/phaseG/normalizePhaseG.ts" <<'EOF'
import type { PhaseGDashboardExport } from "./types";

type AnyRecord = Record<string, any>;

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function arrayOr<T>(value: unknown, fallback: T[] = []): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

export function normalizePhaseGExport(raw: AnyRecord): PhaseGDashboardExport {
  if (raw?.reasoning_layer && raw?.simulation_layer && raw?.decision_layer && raw?.evidence_package) {
    return raw as PhaseGDashboardExport;
  }

  const missionId =
    stringOr(raw?.scenario?.id, "") ||
    stringOr(raw?.scenario_id, "") ||
    stringOr(raw?.mission_id, "uas-maritime-cyber-v001");

  const replayHash =
    raw?.replay_hash ??
    raw?.integrity?.replay_hash ??
    raw?.verification?.replay_hash ??
    "unknown";

  const observations = arrayOr<any>(raw?.events)
    .slice(-8)
    .map((event) => {
      const tick = event.tick ?? event.t ?? "?";
      const type = event.type ?? event.kind ?? "event";
      const title = event.title ?? event.message ?? event.description ?? "";
      return `T+${tick} ${type}${title ? `: ${title}` : ""}`;
    });

  const candidateActions = arrayOr<any>(raw?.coa_recommendations ?? raw?.coas ?? raw?.candidate_actions)
    .map((coa, index) => ({
      id: stringOr(coa.id ?? coa.action_id, `coa_${index + 1}`),
      label: stringOr(coa.label ?? coa.name ?? coa.action_id, `COA ${index + 1}`),
      expected_gain: numberOr(coa.expected_gain ?? coa.gain ?? coa.utility ?? coa.score, 0),
      risk: numberOr(coa.risk ?? coa.risk_score, 0),
      authority_required: Boolean(coa.authority_required ?? coa.requires_authority ?? false),
    }));

  const selected =
    stringOr(raw?.selected_coa, "") ||
    stringOr(raw?.recommendation?.selected_coa, "") ||
    stringOr(raw?.recommendation?.action_id, "") ||
    (candidateActions[0]?.id ?? "hold");

  const counterfactuals = arrayOr<any>(raw?.counterfactual_results ?? raw?.counterfactuals)
    .map((cf) => ({
      action_id: stringOr(cf.action_id, "unknown_action"),
      baseline_outcome: stringOr(cf.baseline_outcome ?? cf.baseline, "baseline"),
      intervention_outcome: stringOr(cf.intervention_outcome ?? cf.outcome, "intervention"),
      effect_delta: numberOr(cf.effect_delta ?? cf.delta ?? cf.effect, 0),
      supports_action: Boolean(cf.supports_action ?? cf.supported ?? false),
    }));

  const causalAssumptions = arrayOr<any>(raw?.causal_assumptions ?? raw?.causal_edges ?? raw?.graph?.edges)
    .map((edge) => ({
      source: stringOr(edge.source ?? edge.from, "unknown_source"),
      target: stringOr(edge.target ?? edge.to, "unknown_target"),
      relation: stringOr(edge.relation ?? edge.type, "causes"),
      confidence: numberOr(edge.confidence, 0.5),
    }));

  const confidenceScore =
    numberOr(raw?.confidence_score ?? raw?.recommendation?.confidence_score ?? raw?.credibility?.score, 0);

  const confidenceBand =
    confidenceScore >= 0.75 ? "high" : confidenceScore >= 0.45 ? "medium" : "low";

  return {
    reasoning_layer: {
      mission_id: missionId,
      objective: stringOr(raw?.scenario?.objective ?? raw?.objective, "Detect and track target before mission cutoff"),
      belief_updates: arrayOr<any>(raw?.belief_updates).map((u) => ({
        tick: numberOr(u.tick, 0),
        source: stringOr(u.source, "unknown"),
        key: stringOr(u.key, "belief"),
        prior: numberOr(u.prior, 0),
        posterior: numberOr(u.posterior, 0),
        rationale: stringOr(u.rationale, ""),
      })),
      causal_assumptions: causalAssumptions,
      uncertainty_notes: arrayOr<string>(raw?.uncertainty_notes),
    },
    simulation_layer: {
      active_backend: "counterfactual",
      runs: counterfactuals,
      replay_hash: replayHash,
    },
    decision_layer: {
      candidate_actions: candidateActions,
      selected_coa: selected,
      confidence_score: confidenceScore,
      confidence_band: confidenceBand,
      caveats: arrayOr<string>(raw?.caveats ?? raw?.recommendation?.caveats),
    },
    evidence_package: {
      mission_id: missionId,
      tick: numberOr(raw?.tick ?? raw?.current_tick, 0),
      observations,
      causal_assumptions: causalAssumptions,
      candidate_actions: candidateActions,
      counterfactual_results: counterfactuals,
      selected_coa: selected,
      confidence_score: confidenceScore,
      confidence_band: confidenceBand,
      caveats: arrayOr<string>(raw?.caveats ?? raw?.recommendation?.caveats),
      replay_hash: replayHash,
    },
  };
}
EOF

cat > "$ROOT/frontend/src/darla/phaseG/PhaseGPanel.tsx" <<'EOF'
import { useMemo, useState } from "react";
import LayerCards from "./LayerCards";
import DecisionTrace from "./DecisionTrace";
import { normalizePhaseGExport } from "./normalizePhaseG";
import "./phaseG.css";

type Props = {
  dashboardData: Record<string, any>;
};

export default function PhaseGPanel({ dashboardData }: Props) {
  const [traceOpen, setTraceOpen] = useState(false);

  const phaseG = useMemo(
    () => normalizePhaseGExport(dashboardData ?? {}),
    [dashboardData]
  );

  return (
    <section aria-label="DARLA Phase G formal reasoning architecture">
      <LayerCards data={phaseG} onOpenTrace={() => setTraceOpen((v) => !v)} />
      {traceOpen && <DecisionTrace data={phaseG} />}
    </section>
  );
}
EOF

echo "[Phase G] Created PhaseGPanel + normalizePhaseG adapter."

echo "[Phase G] Checking C++ build"
cmake -S "$ROOT" -B "$ROOT/build-make"
cmake --build "$ROOT/build-make"
ctest --test-dir "$ROOT/build-make" --output-on-failure

if [[ -d "$ROOT/frontend" ]]; then
  echo "[Phase G] Checking frontend build"
  (cd "$ROOT/frontend" && npm run build)
fi

echo "[Phase G] Done."
echo ""
echo "Next manual step:"
echo "  Import PhaseGPanel into the main dashboard component and render:"
echo "    <PhaseGPanel dashboardData={data} />"
