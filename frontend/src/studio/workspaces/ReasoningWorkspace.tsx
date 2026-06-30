import BezierReasoningGraph from "../widgets/BezierReasoningGraph";
import { getCausalEdges, getCounterfactuals } from "../dataSelectors";

type Props = { data: Record<string, any> };

export default function ReasoningWorkspace({ data }: Props) {
  const edges = getCausalEdges(data);
  const counterfactuals = getCounterfactuals(data);

  return (
    <div className="workspace">
      <header className="workspace-header">
        <div>
          <span className="kicker">Reasoning</span>
          <h1>Causal Decision Pipeline</h1>
          <p>Observation → belief → causal effect → counterfactual → COA decision.</p>
        </div>
      </header>

      <BezierReasoningGraph data={data} />

      <section className="two-column">
        <article className="panel">
          <span className="kicker">Causal Edges</span>
          <h3>Assumptions in use</h3>
          <ul className="event-list">
            {(edges.length ? edges : [{ source: "red_cyber_effect", target: "sensor_confidence", relation: "degrades", confidence: 0.86 }]).map((edge, index) => (
              <li key={index}>
                <b>{edge.source ?? edge.from}</b> → <b>{edge.target ?? edge.to}</b>{" "}
                {edge.relation ?? edge.type ?? "causes"}
              </li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <span className="kicker">Counterfactuals</span>
          <h3>Executable branches</h3>
          <ul className="event-list">
            {(counterfactuals.length ? counterfactuals : [{ action_id: "No counterfactuals exported", effect_delta: 0 }]).map((cf, index) => (
              <li key={index}>
                <b>{cf.action_id}</b> · Δ {Number(cf.effect_delta ?? cf.delta ?? 0).toFixed(3)}
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
