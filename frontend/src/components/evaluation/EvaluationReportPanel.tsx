import type { EvaluationReport } from "../../evaluation/types";
import { pct } from "../../evaluation/evalUi";
import EvalMetricCard from "./EvalMetricCard";
import EvalStatusBadge from "./EvalStatusBadge";

export default function EvaluationReportPanel({ report }: { report: EvaluationReport }) {
  return (
    <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_360px] gap-4 overflow-hidden">
      <section className="min-h-0 overflow-y-auto pr-1">
        <div className="rounded-2xl border border-darla-border bg-darla-panel p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-darla-text-muted">DARPA evaluation harness</div>
              <h1 className="mt-1 text-2xl font-semibold text-darla-text">Blind causal/COA evaluation</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-darla-text-secondary">
                Scores runtime causal hypotheses, COA gates, proper abstention, and reproducibility without treating planted truth as runtime evidence.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <EvalStatusBadge status={report.summaryStatus} />
              <div className="font-mono text-sm text-darla-text-muted">readiness {pct(report.readinessScore)}</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {report.metrics.map((metric) => <EvalMetricCard key={metric.id} metric={metric} />)}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="rounded-2xl border border-darla-border bg-darla-panel p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-darla-text">Causal recovery</h2>
              <span className="rounded-full border border-darla-border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-darla-text-muted">
                {report.causalRecovery.truthAccess.replaceAll("_", " ")}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-darla-panel-elevated p-2"><div className="text-lg font-semibold text-darla-text">{pct(report.causalRecovery.precision)}</div><div className="text-[10px] text-darla-text-muted">precision</div></div>
              <div className="rounded-lg bg-darla-panel-elevated p-2"><div className="text-lg font-semibold text-darla-text">{pct(report.causalRecovery.recall)}</div><div className="text-[10px] text-darla-text-muted">recall</div></div>
              <div className="rounded-lg bg-darla-panel-elevated p-2"><div className="text-lg font-semibold text-darla-text">{pct(report.causalRecovery.falseCausalClaimRate)}</div><div className="text-[10px] text-darla-text-muted">false claims</div></div>
            </div>
            <div className="mt-4 grid gap-3 text-xs text-darla-text-secondary">
              <div><div className="mb-1 font-semibold text-darla-text">True positive edges</div>{report.causalRecovery.truePositiveEdges.length ? report.causalRecovery.truePositiveEdges.map((edge) => <div key={edge} className="font-mono text-[11px]">{edge}</div>) : <span className="text-darla-text-muted">None yet.</span>}</div>
              <div><div className="mb-1 font-semibold text-darla-text">Missed expected edges</div>{report.causalRecovery.missedEdges.length ? report.causalRecovery.missedEdges.map((edge) => <div key={edge} className="font-mono text-[11px] text-amber-300">{edge}</div>) : <span className="text-emerald-300">No expected edge missed.</span>}</div>
              <div><div className="mb-1 font-semibold text-darla-text">Potential false positives</div>{report.causalRecovery.falsePositiveEdges.length ? report.causalRecovery.falsePositiveEdges.slice(0, 6).map((edge) => <div key={edge} className="font-mono text-[11px] text-red-300">{edge}</div>) : <span className="text-emerald-300">No accepted false positive edge.</span>}</div>
            </div>
          </section>

          <section className="rounded-2xl border border-darla-border bg-darla-panel p-4">
            <h2 className="text-sm font-semibold text-darla-text">COA / abstention evaluation</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-darla-panel-elevated p-2"><div className="text-lg font-semibold text-darla-text">{pct(report.coaEvaluation.correctCoaRate)}</div><div className="text-[10px] text-darla-text-muted">correct COA</div></div>
              <div className="rounded-lg bg-darla-panel-elevated p-2"><div className="text-lg font-semibold text-darla-text">{pct(report.coaEvaluation.unsafeCoaRate)}</div><div className="text-[10px] text-darla-text-muted">unsafe COA</div></div>
              <div className="rounded-lg bg-darla-panel-elevated p-2"><div className="text-lg font-semibold text-darla-text">{pct(report.coaEvaluation.properAbstentionRate)}</div><div className="text-[10px] text-darla-text-muted">proper abstain</div></div>
              <div className="rounded-lg bg-darla-panel-elevated p-2"><div className="text-lg font-semibold text-darla-text">{pct(report.coaEvaluation.humanReviewRate)}</div><div className="text-[10px] text-darla-text-muted">human review</div></div>
            </div>
            <div className="mt-4 text-xs text-darla-text-secondary">
              <div className="mb-1 font-semibold text-darla-text">Recommended actions</div>
              {report.coaEvaluation.recommendedActions.length ? report.coaEvaluation.recommendedActions.map((item) => <div key={item} className="font-mono text-[11px]">{item}</div>) : <span className="text-darla-text-muted">No recommendations yet.</span>}
            </div>
            <ul className="mt-3 space-y-1 text-xs text-darla-text-muted">
              {report.coaEvaluation.notes.map((note) => <li key={note}>• {note}</li>)}
            </ul>
          </section>
        </div>

        <section className="mt-4 rounded-2xl border border-darla-border bg-darla-panel p-4">
          <h2 className="text-sm font-semibold text-darla-text">Blind challenge pack</h2>
          <div className="mt-3 grid gap-2">
            {report.challengeResults.map((scenario) => (
              <div key={scenario.id} className="rounded-xl border border-darla-border bg-darla-panel-elevated p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-darla-text">{scenario.label}</div>
                    <p className="mt-1 text-xs leading-5 text-darla-text-secondary">{scenario.description}</p>
                  </div>
                  <EvalStatusBadge status={scenario.status} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-darla-text-muted md:grid-cols-4">
                  <span>Expected: {scenario.expectedBehavior}</span>
                  <span>Precision: {pct(scenario.causalPrecision)}</span>
                  <span>Recall: {pct(scenario.causalRecall)}</span>
                  <span>{scenario.executable ? "Executable" : "Scoring metadata"}</span>
                </div>
                {scenario.evidenceNotes.length ? <div className="mt-2 text-[11px] text-darla-text-muted">{scenario.evidenceNotes.join(" · ")}</div> : null}
              </div>
            ))}
          </div>
        </section>
      </section>

      <aside className="min-h-0 overflow-y-auto rounded-2xl border border-darla-border bg-darla-panel p-4">
        <h2 className="text-sm font-semibold text-darla-text">Evidence bundle scoring</h2>
        <div className="mt-2 flex items-center justify-between rounded-xl border border-darla-border bg-darla-panel-elevated p-3">
          <span className="text-xs text-darla-text-muted">Bundle score</span>
          <span className="text-xl font-semibold text-darla-text">{pct(report.evidenceBundle.score)}</span>
        </div>
        <div className="mt-3 text-xs text-darla-text-secondary">
          <div className="font-semibold text-darla-text">Present artifacts</div>
          <ul className="mt-1 space-y-1">
            {report.evidenceBundle.presentArtifacts.map((item) => <li key={item}>✓ {item}</li>)}
          </ul>
        </div>
        {report.evidenceBundle.missingArtifacts.length ? (
          <div className="mt-3 text-xs text-amber-300">
            <div className="font-semibold">Missing artifacts</div>
            <ul className="mt-1 space-y-1">
              {report.evidenceBundle.missingArtifacts.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
        ) : null}
        <h2 className="mt-5 text-sm font-semibold text-darla-text">Reproducibility</h2>
        <div className="mt-2 rounded-xl border border-darla-border bg-darla-panel-elevated p-3 text-xs text-darla-text-secondary">
          <div>Replay hash: {report.reproducibility.replayHashPresent ? "present" : "missing"}</div>
          <div>Dropped SSE blocks: {report.reproducibility.droppedSseBlocks}</div>
          <div className="mt-2"><EvalStatusBadge status={report.reproducibility.deterministicReplayStatus} /></div>
        </div>
        <h2 className="mt-5 text-sm font-semibold text-darla-text">Next technical risks</h2>
        <ul className="mt-2 space-y-2 text-xs leading-5 text-darla-text-secondary">
          {report.recommendations.map((item) => <li key={item}>• {item}</li>)}
        </ul>
      </aside>
    </div>
  );
}
