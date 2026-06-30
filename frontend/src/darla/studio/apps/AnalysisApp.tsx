type Props = {
  dashboardData: Record<string, any>;
};

export default function AnalysisApp({ dashboardData }: Props) {
  const metrics = dashboardData?.metrics ?? dashboardData?.calibration ?? dashboardData?.verification ?? {};

  return (
    <div className="ds-app">
      <header className="ds-app-header">
        <div>
          <span className="ds-kicker">Analysis</span>
          <h1>Trust, Replay, and Validation</h1>
        </div>
      </header>

      <section className="ds-panel-grid three">
        <Metric label="Brier" value={metrics.brier ?? metrics.brier_score ?? "—"} />
        <Metric label="ECE" value={metrics.ece ?? "—"} />
        <Metric label="CI Coverage" value={metrics.ci_coverage ?? "—"} />
      </section>

      <section className="ds-panel">
        <span className="ds-kicker">Validation posture</span>
        <h3>Do not overclaim</h3>
        <p>
          DARLA demonstrates auditable causal claims in a controlled micro-world. It does not yet prove
          operational causal discovery or production VV&amp;A.
        </p>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: unknown }) {
  const v = typeof value === "number" ? value.toFixed(4) : String(value);
  return (
    <article className="ds-panel metric">
      <span className="ds-kicker">{label}</span>
      <h2>{v}</h2>
    </article>
  );
}
