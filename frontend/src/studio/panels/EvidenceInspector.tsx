import { getConfidence, getSelectedCoa, getCausalEdges, getCounterfactuals } from "../dataSelectors";

type Props = { data: Record<string, any> };

export default function EvidenceInspector({ data }: Props) {
  const selected = getSelectedCoa(data);
  const confidence = getConfidence(data);
  const edges = getCausalEdges(data);
  const counterfactuals = getCounterfactuals(data);

  return (
    <div>
      <div className="section-label">Inspector</div>
      <section className="studio-card">
        <span className="kicker">Selected COA</span>
        <b>{selected}</b>
        <p>Confidence {Math.round(confidence * 100)}%</p>
      </section>

      <div className="section-label">Evidence</div>
      <section className="studio-card">
        <b>Formal support</b>
        <p>{edges.length} causal edges</p>
        <p>{counterfactuals.length} counterfactual runs</p>
      </section>

      <div className="section-label">Raw Access</div>
      <section className="studio-card">
        <details>
          <summary>JSON preview</summary>
          <pre className="json-preview">{JSON.stringify(data, null, 2).slice(0, 3500)}</pre>
        </details>
      </section>
    </div>
  );
}
