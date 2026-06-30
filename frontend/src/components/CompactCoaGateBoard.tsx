import { useDarlaSelection } from "../context/SelectionContext";
import "./compactCoaGateBoard.css";

type Props = {
  dashboardData: Record<string, any>;
  maxRows?: number;
};

function arr<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function pct(value: unknown): string {
  return `${Math.round(num(value, 0) * 100)}%`;
}

export default function CompactCoaGateBoard({ dashboardData, maxRows = 8 }: Props) {
  const { setSelection } = useDarlaSelection();

  const rows = arr<any>(
    dashboardData?.evidence_package?.candidate_actions ??
      dashboardData?.decision_layer?.candidate_actions ??
      dashboardData?.coa_gates ??
      dashboardData?.coa_recommendations ??
      dashboardData?.coas ??
      dashboardData?.candidate_actions
  )
    .map((row, index) => {
      const id = String(row.id ?? row.action_id ?? `coa_${index + 1}`);
      const support = num(row.causal_support ?? row.expected_gain ?? row.gain ?? row.utility ?? row.score, 0);
      const resource = num(row.resource_clear ?? row.resource_score ?? 1, 1);
      const risk = num(row.risk ?? row.risk_score, 0);
      const authority = Boolean(row.authority_required ?? row.requires_authority);
      const preconditions =
        row.preconditions_met === true || row.preconditions === "met"
          ? "met"
          : row.preconditions_met === false || row.preconditions === "not met"
            ? "not met"
            : "unknown";
      const status =
        row.status ??
        row.gate ??
        (support > 0.1 && resource > 0.5 && preconditions !== "not met" ? "recommend" : "abstain");

      return {
        id,
        label: String(row.label ?? row.name ?? id),
        support,
        resource,
        risk,
        authority,
        preconditions,
        status,
        payload: row,
      };
    })
    .sort((a, b) => b.support - a.support)
    .slice(0, maxRows);

  return (
    <section className="coa-board">
      <header className="coa-board-head">
        <div>
          <div className="coa-kicker">COA Gate Board</div>
          <h2>Decision gates</h2>
        </div>
        <div className="coa-summary">
          <span>{rows.filter((r) => r.status === "recommend").length} recommend</span>
          <span>{rows.filter((r) => r.authority).length} authority</span>
          <span>{rows.filter((r) => r.preconditions === "not met").length} blocked</span>
        </div>
      </header>

      <table className="coa-table">
        <thead>
          <tr>
            <th>COA</th>
            <th>Causal</th>
            <th>Resource</th>
            <th>Risk</th>
            <th>Authority</th>
            <th>Preconditions</th>
            <th>Gate</th>
          </tr>
        </thead>
        <tbody>
          {(rows.length ? rows : [{
            id: "hold",
            label: "Hold / gather more evidence",
            support: 0,
            resource: 1,
            risk: 0,
            authority: false,
            preconditions: "unknown",
            status: "hold",
            payload: {}
          }]).map((row) => (
            <tr
              key={row.id}
              onClick={() =>
                setSelection({
                  kind: "coa",
                  id: row.id,
                  label: row.label,
                  payload: row.payload,
                })
              }
            >
              <td>
                <b>{row.label}</b>
                <small>{row.id}</small>
              </td>
              <td><Meter value={row.support} />{pct(row.support)}</td>
              <td><Meter value={row.resource} pale />{pct(row.resource)}</td>
              <td>{pct(row.risk)}</td>
              <td><Badge value={row.authority ? "required" : "clear"} /></td>
              <td><Badge value={row.preconditions} /></td>
              <td><Badge value={row.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Meter({ value, pale = false }: { value: number; pale?: boolean }) {
  return (
    <div className={`coa-meter ${pale ? "pale" : ""}`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

function Badge({ value }: { value: string }) {
  return <span className={`coa-badge ${value.replace(/\s+/g, "-")}`}>{value}</span>;
}
