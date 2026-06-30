import { useDarlaSelection } from "../context/SelectionContext";
import "./synchronizedInspector.css";

type Props = {
  dashboardData: Record<string, any>;
};

function arr<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function pct(value: unknown): string {
  const n = typeof value === "number" ? value : 0;
  return `${Math.round(n * 100)}%`;
}

function getSelectedCoa(data: Record<string, any>) {
  return (
    data?.evidence_package?.selected_coa ||
    data?.decision_layer?.selected_coa ||
    data?.recommendation?.selected_coa ||
    data?.recommendation?.action_id ||
    data?.selected_coa ||
    "hold"
  );
}

function getConfidence(data: Record<string, any>) {
  return (
    data?.evidence_package?.confidence_score ??
    data?.decision_layer?.confidence_score ??
    data?.recommendation?.confidence_score ??
    data?.confidence_score ??
    0
  );
}

export default function SynchronizedInspector({ dashboardData }: Props) {
  const { selection, clearSelection } = useDarlaSelection();

  const selectedCoa = getSelectedCoa(dashboardData);
  const confidence = getConfidence(dashboardData);
  const edges = arr<any>(
    dashboardData?.evidence_package?.causal_assumptions ??
      dashboardData?.reasoning_layer?.causal_assumptions ??
      dashboardData?.causal_assumptions ??
      dashboardData?.graph?.edges
  );
  const counterfactuals = arr<any>(
    dashboardData?.evidence_package?.counterfactual_results ??
      dashboardData?.simulation_layer?.runs ??
      dashboardData?.counterfactual_results
  );
  const events = arr<any>(
    dashboardData?.evidence_package?.observations ??
      dashboardData?.events ??
      dashboardData?.observations
  );

  if (selection.kind === "none") {
    return (
      <aside className="sync-inspector">
        <div className="sync-kicker">Mission Inspector</div>
        <h2>Current mission state</h2>
        <p className="sync-muted">
          No specific object or moment is selected. Showing the current operational recommendation.
        </p>

        <section className="sync-card sync-primary">
          <div className="sync-kicker">Recommendation</div>
          <h3>{selectedCoa}</h3>
          <p>Confidence {pct(confidence)}</p>
        </section>

        <section className="sync-grid">
          <div className="sync-card">
            <b>{events.length}</b>
            <span>observations</span>
          </div>
          <div className="sync-card">
            <b>{edges.length}</b>
            <span>causal edges</span>
          </div>
          <div className="sync-card">
            <b>{counterfactuals.length}</b>
            <span>branches</span>
          </div>
        </section>

        <section className="sync-card">
          <div className="sync-kicker">What to do</div>
          <p>
            Click a map object, timeline event, COA, or causal edge to synchronize this inspector
            with the selected evidence.
          </p>
        </section>
      </aside>
    );
  }

  return (
    <aside className="sync-inspector">
      <div className="sync-row">
        <div>
          <div className="sync-kicker">Selected {selection.kind}</div>
          <h2>{selection.label ?? selection.id ?? "Selection"}</h2>
        </div>
        <button onClick={clearSelection}>Clear</button>
      </div>

      {typeof selection.tick === "number" && (
        <section className="sync-card">
          <div className="sync-kicker">Moment</div>
          <h3>T+{selection.tick}</h3>
          <p>All panels should filter or highlight evidence connected to this tick.</p>
        </section>
      )}

      <section className="sync-card">
        <div className="sync-kicker">Payload</div>
        <pre>{JSON.stringify(selection.payload ?? selection, null, 2)}</pre>
      </section>

      <section className="sync-card">
        <div className="sync-kicker">Linked Evidence</div>
        <p>
          Next backend pass should return object-specific evidence links:
          events, causal edges, counterfactuals, and COA impact.
        </p>
      </section>
    </aside>
  );
}
