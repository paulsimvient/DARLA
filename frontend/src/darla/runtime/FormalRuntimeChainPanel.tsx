import { useMemo } from "react";
import { buildFormalRuntimeChain } from "./buildFormalRuntimeChain";
import type { FormalRuntimeStep } from "./formalTypes";
import "./formalRuntime.css";

type Props = {
  dashboardData: Record<string, any>;
};

const labels: Record<FormalRuntimeStep["kind"], string> = {
  observation: "Observation",
  belief_update: "Belief",
  causal_assumption: "Causal",
  counterfactual: "Counterfactual",
  coa_gate: "COA Gate",
  evidence_package: "Evidence",
  recommendation: "Decision",
};

function pct(value?: number): string {
  if (typeof value !== "number") return "—";
  return `${Math.round(value * 100)}%`;
}

export default function FormalRuntimeChainPanel({ dashboardData }: Props) {
  const chain = useMemo(() => buildFormalRuntimeChain(dashboardData ?? {}), [dashboardData]);

  return (
    <section className="fr-shell">
      <header className="fr-header">
        <div>
          <div className="fr-kicker">Formal Runtime Chain</div>
          <h2>{chain.missionId}</h2>
          <p>
            Observation → belief update → causal assumption → counterfactual → COA gate →
            recommendation.
          </p>
        </div>
        <div className="fr-rec">
          <span>{chain.recommendation.status}</span>
          <b>{chain.recommendation.selectedCoa}</b>
          <small>{pct(chain.recommendation.confidence)}</small>
        </div>
      </header>

      <div className="fr-chain">
        {chain.steps.map((step, index) => (
          <article className={`fr-step fr-step-${step.status}`} key={step.id}>
            <div className="fr-index">{index + 1}</div>
            <div className="fr-body">
              <div className="fr-row">
                <span className="fr-kind">{labels[step.kind]}</span>
                <span className="fr-status">{step.status}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.summary}</p>
              <footer>
                {typeof step.tick === "number" && <span>T+{step.tick}</span>}
                <span>confidence {pct(step.confidence)}</span>
              </footer>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
