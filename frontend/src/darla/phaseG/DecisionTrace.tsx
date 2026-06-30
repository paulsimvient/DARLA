import type { PhaseGDashboardExport } from "./types";

type Props = {
  data: PhaseGDashboardExport;
};

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function DecisionTrace({ data }: Props) {
  const evidence = data.evidence_package;

  return (
    <section className="phase-g-trace" aria-label="Decision trace">
      <header>
        <div className="phase-g-card-kicker">Decision Trace</div>
        <h2>{evidence.mission_id}</h2>
        <p>
          Tick {evidence.tick} · selected COA: <b>{evidence.selected_coa}</b> · confidence{" "}
          <b>{pct(evidence.confidence_score)}</b>
        </p>
      </header>

      <div className="phase-g-trace-grid">
        <article>
          <h3>Observations</h3>
          <ul>
            {evidence.observations.map((item, i) => (
              <li key={`${item}-${i}`}>{item}</li>
            ))}
          </ul>
        </article>

        <article>
          <h3>Belief updates</h3>
          <ul>
            {data.reasoning_layer.belief_updates.map((u) => (
              <li key={`${u.tick}-${u.source}-${u.key}`}>
                T+{u.tick} · {u.source}: {u.key} {u.prior.toFixed(2)} → {u.posterior.toFixed(2)}
              </li>
            ))}
          </ul>
        </article>

        <article>
          <h3>Causal assumptions</h3>
          <ul>
            {evidence.causal_assumptions.map((a) => (
              <li key={`${a.source}-${a.target}-${a.relation}`}>
                {a.source} → {a.target} ({a.relation}, {pct(a.confidence)})
              </li>
            ))}
          </ul>
        </article>

        <article>
          <h3>Counterfactuals</h3>
          <ul>
            {evidence.counterfactual_results.map((r) => (
              <li key={r.action_id}>
                {r.action_id}: Δ {r.effect_delta.toFixed(3)} ·{" "}
                {r.supports_action ? "supports" : "does not support"}
              </li>
            ))}
          </ul>
        </article>

        <article>
          <h3>COA ranking</h3>
          <ul>
            {evidence.candidate_actions.map((a) => (
              <li key={a.id}>
                {a.label}: gain {a.expected_gain.toFixed(3)}, risk {a.risk.toFixed(3)}
              </li>
            ))}
          </ul>
        </article>

        <article>
          <h3>Caveats</h3>
          {evidence.caveats.length === 0 ? (
            <p>No caveats emitted.</p>
          ) : (
            <ul>
              {evidence.caveats.map((c, i) => (
                <li key={`${c}-${i}`}>{c}</li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
