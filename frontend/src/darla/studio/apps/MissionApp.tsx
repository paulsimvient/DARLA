type Props = {
  dashboardData: Record<string, any>;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export default function MissionApp({ dashboardData }: Props) {
  const evidence = dashboardData?.evidence_package ?? {};
  const selected =
    evidence.selected_coa ||
    dashboardData?.decision_layer?.selected_coa ||
    dashboardData?.recommendation?.action_id ||
    "hold";
  const confidence =
    evidence.confidence_score ??
    dashboardData?.decision_layer?.confidence_score ??
    dashboardData?.confidence_score ??
    0;
  const caveats = asArray<string>(evidence.caveats ?? dashboardData?.decision_layer?.caveats);

  return (
    <div className="ds-app">
      <header className="ds-app-header">
        <div>
          <span className="ds-kicker">Mission</span>
          <h1>Commander Decision View</h1>
        </div>
        <div className="ds-action-group">
          <button>Approve</button>
          <button>Hold</button>
          <button>Export Evidence</button>
        </div>
      </header>

      <section className="ds-hero-recommendation">
        <span className="ds-kicker">Current Recommendation</span>
        <h2>{selected}</h2>
        <p>
          Confidence {Math.round(Number(confidence || 0) * 100)}%
          {caveats.length ? ` · ${caveats[0]}` : ""}
        </p>
      </section>

      <section className="ds-panel-grid three">
        <article className="ds-panel">
          <span className="ds-kicker">What is happening?</span>
          <h3>Mission state changed</h3>
          <p>Surface the operational condition first. Details move into reasoning and evidence drilldowns.</p>
        </article>
        <article className="ds-panel">
          <span className="ds-kicker">Why?</span>
          <h3>Causal support is being evaluated</h3>
          <p>DARLA should explain the evidence path, not just rank COAs.</p>
        </article>
        <article className="ds-panel">
          <span className="ds-kicker">What now?</span>
          <h3>Review gate board</h3>
          <p>Approve, hold, or inspect the counterfactual evidence behind the recommendation.</p>
        </article>
      </section>

      <CoaCompactTable dashboardData={dashboardData} />
    </div>
  );
}

function CoaCompactTable({ dashboardData }: Props) {
  const rows = asArray<any>(
    dashboardData?.evidence_package?.candidate_actions ??
      dashboardData?.decision_layer?.candidate_actions ??
      dashboardData?.coa_recommendations ??
      dashboardData?.coas
  ).slice(0, 6);

  return (
    <section className="ds-panel">
      <div className="ds-panel-head">
        <div>
          <span className="ds-kicker">COA Gate Board</span>
          <h3>Ranked options</h3>
        </div>
      </div>
      <table className="ds-table">
        <thead>
          <tr>
            <th>COA</th>
            <th>Support</th>
            <th>Risk</th>
            <th>Authority</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {(rows.length ? rows : [{ id: "hold", label: "Hold", expected_gain: 0, risk: 0 }]).map((r, i) => {
            const support = Number(r.expected_gain ?? r.gain ?? r.score ?? 0);
            const risk = Number(r.risk ?? r.risk_score ?? 0);
            return (
              <tr key={r.id ?? i}>
                <td><b>{r.label ?? r.name ?? r.id ?? `COA ${i + 1}`}</b><small>{r.id ?? r.action_id}</small></td>
                <td>{Math.round(support * 100)}%</td>
                <td>{Math.round(risk * 100)}%</td>
                <td>{r.authority_required ? "required" : "clear"}</td>
                <td>{support > 0.05 ? "candidate" : "weak"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
