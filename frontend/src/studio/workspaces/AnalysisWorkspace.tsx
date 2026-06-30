type Props = { data: Record<string, any> };

export default function AnalysisWorkspace({ data }: Props) {
  const metrics = data?.metrics ?? data?.calibration ?? data?.verification ?? {};
  return (
    <div className="workspace">
      <header className="workspace-header">
        <div>
          <span className="kicker">Analysis</span>
          <h1>Trust, Replay, and Validation</h1>
          <p>Separate operational recommendation from scientific credibility.</p>
        </div>
      </header>

      <section className="metric-grid">
        <Metric label="Brier" value={metrics.brier ?? metrics.brier_score ?? "—"} />
        <Metric label="ECE" value={metrics.ece ?? "—"} />
        <Metric label="CI Coverage" value={metrics.ci_coverage ?? "—"} />
        <Metric label="Replay Hash" value={data?.replay_hash ?? data?.verification?.replay_hash ?? "—"} />
      </section>

      <section className="panel warning">
        <span className="kicker">Safe Claim</span>
        <h3>Controlled evidence-producing simulation</h3>
        <p>
          DARLA demonstrates auditable causal claims in a controlled micro-world. It should not yet be
          claimed as operational causal discovery or production VV&amp;A.
        </p>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <article className="panel metric">
      <span className="kicker">{label}</span>
      <h2>{typeof value === "number" ? value.toFixed(4) : String(value)}</h2>
    </article>
  );
}
