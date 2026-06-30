import { useDarlaSelection } from "../context/SelectionContext";
import "./evidenceChainPanel.css";

type Props = {
  dashboardData: Record<string, any>;
};

function arr<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export default function EvidenceChainPanel({ dashboardData }: Props) {
  const { selection } = useDarlaSelection();

  const observations = arr<any>(
    dashboardData?.evidence_package?.observations ??
      dashboardData?.events ??
      dashboardData?.observations
  );
  const beliefs = arr<any>(
    dashboardData?.reasoning_layer?.belief_updates ??
      dashboardData?.belief_updates
  );
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

  const selectedCoa =
    dashboardData?.evidence_package?.selected_coa ??
    dashboardData?.decision_layer?.selected_coa ??
    dashboardData?.recommendation?.action_id ??
    "hold";

  return (
    <section className="evidence-chain">
      <header>
        <div>
          <div className="ev-kicker">Evidence Chain</div>
          <h2>{selection.kind === "none" ? "Current decision path" : `Linked to ${selection.kind}`}</h2>
        </div>
        <span>{selection.label ?? selection.id ?? selectedCoa}</span>
      </header>

      <div className="ev-steps">
        <Step
          n={1}
          title="Observation"
          body={observations[0] ? formatObservation(observations[0]) : "No formal observation exported yet."}
          status={observations.length ? "ok" : "warn"}
        />
        <Step
          n={2}
          title="Belief Update"
          body={beliefs[0] ? formatBelief(beliefs[0]) : "Belief updates are not yet exported; add this in persistent-agent pass."}
          status={beliefs.length ? "ok" : "warn"}
        />
        <Step
          n={3}
          title="Causal Support"
          body={edges[0] ? formatEdge(edges[0]) : "No causal edge connected to this decision was exported."}
          status={edges.length ? "ok" : "warn"}
        />
        <Step
          n={4}
          title="Counterfactual"
          body={counterfactuals[0] ? formatCounterfactual(counterfactuals[0]) : "No executable branch summary exported."}
          status={counterfactuals.length ? "ok" : "blocked"}
        />
        <Step
          n={5}
          title="Decision"
          body={`Selected recommendation: ${selectedCoa}`}
          status={selectedCoa === "hold" ? "warn" : "ok"}
        />
      </div>
    </section>
  );
}

function Step({ n, title, body, status }: { n: number; title: string; body: string; status: "ok" | "warn" | "blocked" }) {
  return (
    <article className={`ev-step ${status}`}>
      <div className="ev-num">{n}</div>
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </article>
  );
}

function formatObservation(o: any) {
  if (typeof o === "string") return o;
  return `T+${o.tick ?? o.t ?? "?"}: ${o.title ?? o.message ?? o.type ?? "observation"}`;
}

function formatBelief(b: any) {
  return `${b.source ?? "agent"} updated ${b.key ?? "belief"} from ${Number(b.prior ?? 0).toFixed(2)} to ${Number(b.posterior ?? 0).toFixed(2)}`;
}

function formatEdge(e: any) {
  return `${e.source ?? e.from} → ${e.target ?? e.to} (${e.relation ?? e.type ?? "causes"})`;
}

function formatCounterfactual(c: any) {
  return `${c.action_id ?? "branch"} changed outcome by Δ ${Number(c.effect_delta ?? c.delta ?? 0).toFixed(3)}`;
}
