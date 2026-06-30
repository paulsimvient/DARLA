import { getCandidateActions, getConfidence, getSelectedCoa, num, pct } from "../dataSelectors";

type Props = { data: Record<string, any> };

export default function MissionWorkspace({ data }: Props) {
  const selected = getSelectedCoa(data);
  const confidence = getConfidence(data);
  const actions = getCandidateActions(data).slice(0, 8);

  return (
    <div className="workspace">
      <header className="workspace-header">
        <div>
          <span className="kicker">Mission</span>
          <h1>Commander Decision View</h1>
          <p>Start with the decision, then drill into evidence.</p>
        </div>
        <div className="button-row">
          <button>Approve</button>
          <button>Hold</button>
          <button>Export Evidence</button>
        </div>
      </header>

      <section className="recommendation-hero">
        <span className="kicker">Recommended COA</span>
        <h2>{selected}</h2>
        <p>Confidence {pct(confidence)}</p>
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="kicker">COA Gate Board</span>
            <h3>Ranked options</h3>
          </div>
          <span>{actions.length} candidates</span>
        </div>

        <table className="studio-table">
          <thead>
            <tr>
              <th>COA</th>
              <th>Support</th>
              <th>Risk</th>
              <th>Authority</th>
              <th>Gate</th>
            </tr>
          </thead>
          <tbody>
            {(actions.length ? actions : [{ id: "hold", label: "Hold", expected_gain: 0, risk: 0 }]).map((action, index) => {
              const support = num(action.expected_gain ?? action.causal_support ?? action.gain ?? action.score, 0);
              const risk = num(action.risk ?? action.risk_score, 0);
              const gate = action.status ?? action.gate ?? (support > 0.05 ? "candidate" : "weak");
              return (
                <tr key={action.id ?? action.action_id ?? index}>
                  <td>
                    <b>{action.label ?? action.name ?? action.id ?? action.action_id ?? `COA ${index + 1}`}</b>
                    <small>{action.id ?? action.action_id}</small>
                  </td>
                  <td>{pct(support)}</td>
                  <td>{pct(risk)}</td>
                  <td>{action.authority_required || action.requires_authority ? "required" : "clear"}</td>
                  <td><span className={`badge ${gate}`}>{gate}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
