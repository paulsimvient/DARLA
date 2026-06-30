type Props = {
  dashboardData: Record<string, any>;
};

const steps = [
  ["Observation", "Runtime event becomes formal evidence"],
  ["Belief Update", "Agent updates confidence and uncertainty"],
  ["Causal Assumption", "Graph edge declares why it matters"],
  ["Counterfactual", "Executable intervention branch is run"],
  ["COA Gate", "Support, resources, authority, and preconditions checked"],
  ["Decision", "Recommend, hold, or refuse"],
];

export default function ReasoningApp({ dashboardData }: Props) {
  const assumptions =
    dashboardData?.evidence_package?.causal_assumptions ??
    dashboardData?.reasoning_layer?.causal_assumptions ??
    dashboardData?.causal_assumptions ??
    [];

  return (
    <div className="ds-app">
      <header className="ds-app-header">
        <div>
          <span className="ds-kicker">Reasoning</span>
          <h1>Causal Decision Pipeline</h1>
        </div>
      </header>

      <section className="ds-pipeline">
        {steps.map(([title, summary], i) => (
          <article className="ds-pipeline-step" key={title}>
            <div className="ds-pipeline-index">{i + 1}</div>
            <h3>{title}</h3>
            <p>{summary}</p>
          </article>
        ))}
      </section>

      <section className="ds-panel">
        <span className="ds-kicker">Causal Edges</span>
        <h3>Assumptions in use</h3>
        <div className="ds-edge-list">
          {(Array.isArray(assumptions) && assumptions.length ? assumptions : [{ source: "red_cyber_effect", target: "sensor_confidence", relation: "degrades", confidence: 0.86 }]).map((a: any, i: number) => (
            <div className="ds-edge-row" key={i}>
              <b>{a.source}</b>
              <span>→</span>
              <b>{a.target}</b>
              <small>{a.relation ?? "causes"} · {Math.round(Number(a.confidence ?? 0.5) * 100)}%</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
