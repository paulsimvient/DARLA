type Props = {
  dashboardData: Record<string, any>;
};

type CoaRow = {
  id: string;
  label: string;
  effectTick: string | number;
  support: number;
  resource: number;
  authority: "clear" | "required" | "blocked";
  preconditions: "met" | "not met" | "unknown";
  status: "recommend" | "approved" | "hold" | "abstain" | "blocked";
  reason: string;
};

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeRows(data: Record<string, any>): CoaRow[] {
  const source =
    data?.evidence_package?.candidate_actions ??
    data?.decision_layer?.candidate_actions ??
    data?.coa_gates ??
    data?.coa_recommendations ??
    data?.coas ??
    [];

  const counterfactuals = asArray<any>(
    data?.evidence_package?.counterfactual_results ??
      data?.simulation_layer?.runs ??
      data?.counterfactual_results
  );

  return asArray<any>(source).map((item, index) => {
    const id = String(item.id ?? item.action_id ?? `coa_${index + 1}`);
    const cf = counterfactuals.find((r) => String(r.action_id) === id);
    const support = Number(
      item.causal_support ??
        item.expected_gain ??
        item.gain ??
        item.utility ??
        cf?.effect_delta ??
        0
    );
    const resource = Number(item.resource_clear ?? item.resource_score ?? 1);
    const authorityRequired = Boolean(item.authority_required ?? item.requires_authority);
    const preconditionsMet =
      item.preconditions_met === true ||
      item.preconditions === "met" ||
      item.gate === "approved";

    let status: CoaRow["status"] = "abstain";
    if (item.status === "approved" || item.gate === "approved") status = "approved";
    else if (item.status === "blocked" || item.gate === "blocked") status = "blocked";
    else if (support > 0.12 && resource > 0.5 && preconditionsMet) status = "recommend";
    else if (id.includes("hold")) status = "hold";

    return {
      id,
      label: String(item.label ?? item.name ?? id),
      effectTick: item.effect_tick ?? item.tick ?? "—",
      support,
      resource,
      authority: authorityRequired ? "required" : "clear",
      preconditions: preconditionsMet ? "met" : item.preconditions_met === false ? "not met" : "unknown",
      status,
      reason:
        item.reason ??
        item.rationale ??
        (support <= 0.05
          ? "Causal support is weak"
          : authorityRequired
          ? "Authority required before execution"
          : "Causal support and resources are sufficient"),
    };
  });
}

function Badge({ value }: { value: string }) {
  return <span className={`mw-badge mw-badge-${value.replace(/\s+/g, "-")}`}>{value}</span>;
}

export default function CoaGateBoard({ dashboardData }: Props) {
  const rows = normalizeRows(dashboardData).sort((a, b) => b.support - a.support).slice(0, 8);

  const approved = rows.filter((r) => r.status === "approved" || r.status === "recommend").length;
  const blocked = rows.filter((r) => r.status === "blocked").length;
  const authority = rows.filter((r) => r.authority === "required").length;

  return (
    <section className="mw-card">
      <div className="mw-board-head">
        <div>
          <div className="mw-kicker">COA Gate Decision Board</div>
          <h3>Ranked options</h3>
        </div>
        <div className="mw-summary-strip">
          <span>Recommend {approved}</span>
          <span>Blocked {blocked}</span>
          <span>Authority {authority}</span>
        </div>
      </div>

      <div className="mw-table-wrap">
        <table className="mw-coa-table">
          <thead>
            <tr>
              <th>COA</th>
              <th>Effect</th>
              <th>Causal support</th>
              <th>Resource</th>
              <th>Authority</th>
              <th>Preconditions</th>
              <th>Gate</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <b>{row.label}</b>
                  <small>{row.id}</small>
                </td>
                <td>T+{row.effectTick}</td>
                <td>
                  <div className="mw-mini-bar">
                    <span style={{ width: `${Math.max(0, Math.min(100, row.support * 100))}%` }} />
                  </div>
                  {pct(row.support)}
                </td>
                <td>
                  <div className="mw-mini-bar pale">
                    <span style={{ width: `${Math.max(0, Math.min(100, row.resource * 100))}%` }} />
                  </div>
                  {pct(row.resource)}
                </td>
                <td><Badge value={row.authority} /></td>
                <td><Badge value={row.preconditions} /></td>
                <td><Badge value={row.status} /></td>
                <td>{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
