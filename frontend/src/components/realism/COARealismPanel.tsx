import type { CoaRealismAssessment } from "../../realism/types";
import ScoreBar from "./ScoreBar";

function dispositionClass(disposition: CoaRealismAssessment["recommendedDisposition"]) {
  switch (disposition) {
    case "recommend":
      return "border-emerald-700/60 bg-emerald-950/30 text-emerald-200";
    case "escalate":
      return "border-blue-700/60 bg-blue-950/30 text-blue-200";
    case "hold":
      return "border-amber-700/60 bg-amber-950/30 text-amber-200";
    default:
      return "border-red-700/60 bg-red-950/30 text-red-200";
  }
}

type COARealismPanelProps = {
  assessments: CoaRealismAssessment[];
  maxItems?: number;
};

export default function COARealismPanel({ assessments, maxItems = 8 }: COARealismPanelProps) {
  const shown = assessments.slice(0, maxItems);
  return (
    <section className="rounded-xl border border-darla-border bg-darla-panel p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-darla-text-secondary">
            COA realism gates
          </h3>
          <p className="mt-1 text-[11px] text-darla-text-muted">
            Adds authority, precondition, risk, expected-gain, and abstention/escalation logic on top of raw COA score.
          </p>
        </div>
        <span className="rounded border border-darla-border px-2 py-1 font-mono text-[10px] text-darla-text-muted">
          {assessments.length} COAs
        </span>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-darla-border/70 bg-darla-surface/60 p-3 text-[11px] text-darla-text-muted">
          No active COA recommendations at this tick. Scrub to a decision point or run the scenario.
        </div>
      ) : (
        <div className="grid gap-2 xl:grid-cols-2">
          {shown.map((item) => (
            <div key={item.coa.id} className="rounded-lg border border-darla-border/70 bg-darla-surface/60 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-semibold text-darla-text">{item.coa.action}</div>
                  <div className="mt-0.5 truncate text-[10px] text-darla-text-muted">target {item.coa.target} · T+{item.coa.proposed_tick}</div>
                </div>
                <span className={`rounded border px-1.5 py-0.5 text-[9px] uppercase ${dispositionClass(item.recommendedDisposition)}`}>
                  {item.recommendedDisposition}
                </span>
              </div>

              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <ScoreBar value={item.expectedMissionGain.mean} label={`gain · 90% [${item.expectedMissionGain.lower90.toFixed(2)}, ${item.expectedMissionGain.upper90.toFixed(2)}]`} tone="green" />
                <ScoreBar value={item.coa.causal_confidence} label="causal support" tone={item.coa.causal_confidence >= 0.55 ? "green" : "amber"} />
                <ScoreBar value={Math.max(0, 1 - item.coa.risk)} label="downside clear" tone={item.coa.risk > 0.45 ? "amber" : "green"} />
                <ScoreBar value={Math.max(0, 1 - item.coa.cost)} label="resource clear" tone={item.coa.cost > 0.65 ? "amber" : "neutral"} />
              </div>

              <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                <span className={`rounded border px-1.5 py-0.5 ${item.authoritySatisfied ? "border-emerald-700/50 text-emerald-300" : "border-amber-700/50 text-amber-300"}`}>
                  authority {item.authoritySatisfied ? "satisfied" : "needed"}
                </span>
                <span className={`rounded border px-1.5 py-0.5 ${item.preconditionsSatisfied ? "border-emerald-700/50 text-emerald-300" : "border-red-700/50 text-red-300"}`}>
                  preconditions {item.preconditionsSatisfied ? "met" : "not met"}
                </span>
                <span className="rounded border border-darla-border px-1.5 py-0.5 text-darla-text-muted">
                  effect T+{Math.round(item.timeToEffectTicks.mean)}
                </span>
              </div>

              <p className="mt-2 text-[10px] leading-relaxed text-darla-text-muted">{item.rationale}</p>
              {item.majorRisks.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-[10px] text-amber-200/90">
                  {item.majorRisks.map((risk) => (
                    <li key={risk}>• {risk}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
