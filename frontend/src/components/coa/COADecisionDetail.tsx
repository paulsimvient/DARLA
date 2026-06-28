import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Badge from "../Badge";
import { fetchCausalSubgraph } from "../../api";
import type { CourseOfAction, CausalSubgraph, DashboardData } from "../../types";
import { buildEvidenceSteps, coaApprovalKey } from "../../utils/coaHelpers";

type COADecisionDetailProps = {
  coa: CourseOfAction | null;
  dashboard: DashboardData | null;
  runId?: string;
  onOpenCausalTrace?: (coa: CourseOfAction) => void;
};

export default function COADecisionDetail({
  coa,
  dashboard,
  runId,
  onOpenCausalTrace,
}: COADecisionDetailProps) {
  const [showPayload, setShowPayload] = useState(false);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [subgraph, setSubgraph] = useState<CausalSubgraph | null>(null);

  useEffect(() => {
    if (!coa || !runId) {
      setSubgraph(null);
      return;
    }
    void fetchCausalSubgraph(runId, { coa_id: coa.id })
      .then(setSubgraph)
      .catch(() => setSubgraph(null));
  }, [coa, runId]);

  if (!coa) {
    return (
      <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-darla-border bg-darla-panel/90 shadow-lg">
        <header className="border-b border-darla-border bg-darla-surface/80 px-4 py-3">
          <div className="text-[13px] font-bold text-darla-text">Decision Detail</div>
          <div className="text-[11px] text-darla-text-muted">Select a COA to inspect evidence</div>
        </header>
        <div className="p-4 text-xs text-darla-text-muted">No COA selected.</div>
      </section>
    );
  }

  const steps = buildEvidenceSteps(coa, dashboard);
  const search = dashboard?.intervention_search;
  const claims = (dashboard?.claims ?? []).filter(
    (claim) =>
      claim.cause_variable.includes(coa.target) ||
      claim.effect_variable.includes(coa.target) ||
      claim.label.toLowerCase().includes(coa.action.replace(/_/g, " ")),
  );

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-darla-border bg-darla-panel/90 shadow-lg">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-darla-border bg-darla-surface/80 px-4">
        <div>
          <div className="text-[13px] font-bold text-darla-text">Decision Detail</div>
          <div className="text-[11px] text-darla-text-muted">Evidence and drilldowns</div>
        </div>
        <span className="text-[11px] text-darla-text-muted">Trace</span>
      </header>

      <div className="darla-scroll min-h-0 flex-1 overflow-auto p-3">
        <Section title="Why this COA">
          <table className="w-full text-[12px]">
            <tbody>
              <Row label="Mission gain" value={coa.expected_mission_gain.toFixed(3)} good />
              <Row label="Causal confidence" value={coa.causal_confidence.toFixed(3)} />
              <Row label="Risk" value={coa.risk.toFixed(3)} good={coa.risk < 0.1} />
              <Row label="Cost" value={String(coa.cost)} />
              <Row label="Score" value={coa.score.toFixed(3)} />
              <Row
                label="Execution window"
                value={`T+${coa.proposed_tick} → T+${coa.scheduled_at_tick}`}
              />
              <Row label="Approval key" value={coaApprovalKey(coa)} />
            </tbody>
          </table>
        </Section>

        {search ? (
          <Section title="Intervention search">
            <div className="space-y-2">
              <InterventionCard label="Lowest cost effective" data={search.lowest_cost_effective} />
              <InterventionCard label="Best effective" data={search.best_effective} />
            </div>
          </Section>
        ) : null}

        <Section title="Evidence chain">
          {steps.map((step, index) => (
            <div key={step.title} className="mb-2.5 grid grid-cols-[26px_1fr] gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-darla-border bg-darla-bg text-[11px] font-bold text-sky-200">
                {index + 1}
              </span>
              <div className="rounded-xl border border-darla-border bg-darla-bg p-2.5">
                <div className="text-[12px] font-bold text-darla-text">{step.title}</div>
                <p className="mt-1 text-[11px] leading-relaxed text-darla-text-muted">{step.body}</p>
              </div>
            </div>
          ))}
        </Section>

        {subgraph ? (
          <Section title="Authoritative causal subgraph">
            <div className="space-y-2 text-[11px] text-darla-text-muted">
              <p>
                {subgraph.nodes.length} path nodes · {subgraph.edges.length} temporal edges ·{" "}
                {subgraph.evidence_events.length} evidence events · {subgraph.claims.length} claims
              </p>
              {subgraph.nodes.slice(0, 6).map((node) => (
                <div
                  key={node.node_id}
                  className="rounded-lg border border-darla-border bg-darla-bg px-2 py-1.5"
                >
                  <span className="font-semibold text-darla-text">{node.label}</span> · {node.type} ·
                  conf {node.confidence.toFixed(2)} · T+{node.tick}
                </div>
              ))}
              {subgraph.claims.slice(0, 3).map((claim) => (
                <div
                  key={claim.label}
                  className="rounded-lg border border-violet-900/40 bg-violet-950/20 px-2 py-1.5"
                >
                  {claim.cause_variable} → {claim.effect_variable} · {claim.status}
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        <Section title="Drilldowns">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="darla-btn text-[11px]" onClick={() => onOpenCausalTrace?.(coa)}>
              Causal graph
            </button>
            <Link to="/causal" className="darla-btn text-[11px]">
              Temporal graph
            </Link>
            <button
              type="button"
              className="darla-btn text-[11px]"
              onClick={() => setShowPayload((value) => !value)}
            >
              Raw solver payload
            </button>
            <button
              type="button"
              className="darla-btn text-[11px]"
              onClick={() => setShowAssumptions((value) => !value)}
            >
              Assumptions
            </button>
            {dashboard?.replay_hash ? (
              <Badge tone="neutral">Replay {dashboard.replay_hash.slice(0, 8)}</Badge>
            ) : null}
          </div>
        </Section>

        {showPayload ? (
          <Section title="Raw solver payload">
            <pre className="overflow-x-auto rounded-xl border border-darla-border bg-darla-bg p-2.5 font-mono text-[10px] leading-relaxed text-darla-text-muted">
              {JSON.stringify(coa, null, 2)}
            </pre>
          </Section>
        ) : null}

        {showAssumptions ? (
          <Section title="Assumptions">
            <div className="space-y-2 text-[11px] text-darla-text-muted">
              <p>
                Authorization mode:{" "}
                <span className="text-darla-text">{dashboard?.authorization_mode ?? "policy_auto"}</span>
              </p>
              {dashboard?.async_validation?.completed ? (
                <p>
                  Async validation:{" "}
                  {dashboard.async_validation.falsification_survived ? "survived" : "failed"} —{" "}
                  {dashboard.async_validation.falsification_summary}
                </p>
              ) : null}
              {claims.length > 0 ? (
                <div className="space-y-1.5">
                  {claims.slice(0, 4).map((claim) => (
                    <div
                      key={claim.label}
                      className="rounded-lg border border-darla-border bg-darla-bg p-2"
                    >
                      <div className="font-semibold text-darla-text">{claim.label}</div>
                      <div>
                        {claim.cause_variable} → {claim.effect_variable} · {claim.status} · conf{" "}
                        {claim.confidence.toFixed(3)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No causal claims directly tied to this COA target.</p>
              )}
            </div>
          </Section>
        ) : null}

        <Section title="Raw rationale">
          <p className="rounded-xl border border-darla-border bg-darla-bg p-2.5 font-mono text-[10px] leading-relaxed text-darla-text-muted">
            {coa.rationale}
          </p>
        </Section>
      </div>
    </section>
  );
}

function InterventionCard({
  label,
  data,
}: {
  label: string;
  data: DashboardData["intervention_search"]["lowest_cost_effective"];
}) {
  return (
    <div className="rounded-xl border border-darla-border bg-darla-bg p-2.5 text-[11px]">
      <div className="font-semibold text-darla-text">{label}</div>
      <div className="mt-1 text-darla-text-muted">{data.options}</div>
      <div className="mt-1 grid grid-cols-2 gap-1 text-darla-text-secondary">
        <span>Mission score {data.mission_score.toFixed(3)}</span>
        <span>Effect {data.estimated_effect.toFixed(3)}</span>
        <span>Cost {data.cost.toFixed(3)}</span>
        <span>Risk {data.risk.toFixed(3)}</span>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-darla-text-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good?: boolean;
}) {
  return (
    <tr className="border-b border-darla-border/60">
      <td className="py-2 text-darla-text-muted">{label}</td>
      <td className={`py-2 text-right font-bold ${good ? "text-emerald-400" : "text-darla-text"}`}>
        {value}
      </td>
    </tr>
  );
}
