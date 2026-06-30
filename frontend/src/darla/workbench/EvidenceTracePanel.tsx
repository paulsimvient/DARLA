type Props = {
  dashboardData: Record<string, any>;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export default function EvidenceTracePanel({ dashboardData }: Props) {
  const evidence = dashboardData?.evidence_package ?? {};
  const observations = asArray<string>(evidence.observations ?? dashboardData?.observations);
  const assumptions = asArray<any>(
    evidence.causal_assumptions ??
      dashboardData?.reasoning_layer?.causal_assumptions ??
      dashboardData?.causal_assumptions
  );
  const counterfactuals = asArray<any>(
    evidence.counterfactual_results ??
      dashboardData?.simulation_layer?.runs ??
      dashboardData?.counterfactual_results
  );

  return (
    <section className="mw-evidence">
      <article className="mw-card">
        <div className="mw-kicker">1 · Observations</div>
        <h3>What DARLA observed</h3>
        <ul>
          {(observations.length ? observations : ["No observations exported yet."]).map((o, i) => (
            <li key={i}>{String(o)}</li>
          ))}
        </ul>
      </article>

      <article className="mw-card">
        <div className="mw-kicker">2 · Causal Assumptions</div>
        <h3>Why the system believes it matters</h3>
        <ul>
          {(assumptions.length ? assumptions : [{ source: "—", target: "—", relation: "not exported", confidence: 0 }]).map((a, i) => (
            <li key={i}>
              <b>{String(a.source)}</b> → <b>{String(a.target)}</b>{" "}
              <span>{String(a.relation ?? "causes")}</span>{" "}
              {typeof a.confidence === "number" ? `(${Math.round(a.confidence * 100)}%)` : ""}
            </li>
          ))}
        </ul>
      </article>

      <article className="mw-card">
        <div className="mw-kicker">3 · Counterfactual Tests</div>
        <h3>What changed when DARLA intervened</h3>
        <ul>
          {(counterfactuals.length ? counterfactuals : [{ action_id: "—", effect_delta: 0, supports_action: false }]).map((c, i) => (
            <li key={i}>
              <b>{String(c.action_id)}</b>: Δ {Number(c.effect_delta ?? 0).toFixed(3)} ·{" "}
              {c.supports_action ? "supports action" : "not enough support"}
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
