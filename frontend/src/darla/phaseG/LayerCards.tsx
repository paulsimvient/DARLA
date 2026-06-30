import type { PhaseGDashboardExport } from "./types";

type Props = {
  data: PhaseGDashboardExport;
  onOpenTrace?: () => void;
};

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function LayerCards({ data, onOpenTrace }: Props) {
  const evidence = data.evidence_package;

  return (
    <section className="phase-g-layer-grid" aria-label="DARLA mission reasoning layers">
      <article className="phase-g-card">
        <div className="phase-g-card-kicker">Reasoning</div>
        <h3>Causal belief state</h3>
        <p>
          {data.reasoning_layer.belief_updates.length} belief updates,{" "}
          {data.reasoning_layer.causal_assumptions.length} causal assumptions.
        </p>
        <small>
          Mission: {data.reasoning_layer.mission_id || evidence.mission_id}
        </small>
      </article>

      <article className="phase-g-card">
        <div className="phase-g-card-kicker">Simulation</div>
        <h3>Executable counterfactuals</h3>
        <p>
          {data.simulation_layer.runs.length} runs through {data.simulation_layer.active_backend}.
        </p>
        <small>Replay hash: {String(data.simulation_layer.replay_hash ?? evidence.replay_hash)}</small>
      </article>

      <article className="phase-g-card phase-g-card-primary">
        <div className="phase-g-card-kicker">Decision</div>
        <h3>{evidence.selected_coa === "hold" ? "Hold / no action" : evidence.selected_coa}</h3>
        <p>
          Confidence {pct(evidence.confidence_score)} · {evidence.confidence_band}
        </p>
        <button type="button" onClick={onOpenTrace}>
          Open Decision Trace
        </button>
      </article>
    </section>
  );
}
