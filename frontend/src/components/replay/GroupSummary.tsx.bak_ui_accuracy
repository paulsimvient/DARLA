import type { ReactNode } from "react";
import type { GroupSummary as GroupSummaryData } from "../../utils/timelineGroupSelection";
import { formatSimTime } from "../../utils/simTime";

type GroupSummaryProps = {
  summary: GroupSummaryData;
  tickSeconds?: number;
};

export default function GroupSummary({ summary, tickSeconds = 1 }: GroupSummaryProps) {
  const hasSelection = summary.rangeLabel !== "—";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-darla-border bg-darla-panel/90 shadow-[0_16px_60px_rgba(0,0,0,0.22)]">
      <div className="flex h-11 items-center justify-between border-b border-darla-border bg-darla-panel-elevated/75 px-3">
        <div>
          <div className="text-[13px] font-black text-darla-text">Moment Analysis</div>
          <div className="text-[11px] text-darla-text-muted">
            {hasSelection ? summary.modeLabel : "Select a window to compare state"}
          </div>
        </div>
        <span className="font-mono text-[11px] text-darla-text-muted">{summary.rangeLabel}</span>
      </div>

      <div className="darla-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {!hasSelection ? (
          <div className="rounded-xl border border-darla-border bg-[#0b1018] p-3 text-xs leading-relaxed text-darla-text-muted">
            Drag across the timeline or click an event to see how mission state, beliefs, and COAs changed
            across that window.
          </div>
        ) : (
          <>
            {summary.metricDeltas.length > 0 ? (
              <section>
                <SectionTitle>Mission state · start → end</SectionTitle>
                <div className="grid gap-2">
                  {summary.metricDeltas.map((metric) => (
                    <MetricRow key={metric.label} metric={metric} />
                  ))}
                </div>
              </section>
            ) : null}

            {summary.laneBreakdown.length > 0 ? (
              <section className="mt-4">
                <SectionTitle>Events by lane</SectionTitle>
                <div className="flex flex-wrap gap-2">
                  {summary.laneBreakdown.map((lane) => (
                    <span
                      key={lane.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#263143] bg-[#0b1018] px-2.5 py-1 text-[11px] text-darla-text-secondary"
                    >
                      <span className={`h-2 w-2 rounded-full ${lane.dotClass}`} />
                      {lane.label}
                      <strong className="text-darla-text">{lane.count}</strong>
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {summary.coasInRange.length > 0 ? (
              <section className="mt-4">
                <SectionTitle>COAs in window</SectionTitle>
                <div className="grid gap-2">
                  {summary.coasInRange.map((coa) => (
                    <div
                      key={`${coa.tick}-${coa.action}-${coa.target}`}
                      className="rounded-xl border border-[#252e3e] bg-[#0b1018] px-2.5 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-darla-text">
                            {coa.action} → {coa.target}
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-darla-text-muted">
                            {formatSimTime(coa.tick, tickSeconds, true)}
                          </div>
                        </div>
                        <span className="rounded-md bg-amber-950/50 px-1.5 py-0.5 font-mono text-[10px] text-amber-200">
                          {coa.score.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {summary.stateChanges.length > 0 ? (
              <section className="mt-4">
                <SectionTitle>Key state changes</SectionTitle>
                <div className="grid gap-2">
                  {summary.stateChanges.map((change) => (
                    <div
                      key={change.field}
                      className="rounded-xl border border-[#252e3e] bg-[#0b1018] px-2.5 py-2 text-[11px]"
                    >
                      <div className="font-semibold text-darla-text">{change.field}</div>
                      <div className="mt-1 font-mono text-darla-text-secondary">
                        {change.before} → {change.after}
                      </div>
                      <div className="mt-1 text-darla-text-muted">
                        {change.eventLabel} · {formatSimTime(change.tick, tickSeconds, true)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {summary.metricDeltas.length === 0 &&
            summary.laneBreakdown.length === 0 &&
            summary.coasInRange.length === 0 &&
            summary.stateChanges.length === 0 ? (
              <div className="rounded-xl border border-darla-border bg-[#0b1018] p-3 text-xs text-darla-text-muted">
                No key events or state changes in this window.
              </div>
            ) : null}

            {summary.recommendationLabel !== "—" ? (
              <section className="mt-4 rounded-xl border border-blue-500/30 bg-blue-950/20 px-2.5 py-2">
                <SectionTitle>Recommended action</SectionTitle>
                <p className="mt-1 text-xs font-semibold text-blue-100">{summary.recommendationLabel}</p>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-darla-text-muted">
      {children}
    </h3>
  );
}

function MetricRow({ metric }: { metric: GroupSummaryData["metricDeltas"][number] }) {
  const toneClass =
    metric.tone === "good"
      ? "text-emerald-300"
      : metric.tone === "bad"
        ? "text-red-400"
        : metric.tone === "warn"
          ? "text-amber-300"
          : "text-darla-text-secondary";

  const arrow =
    metric.direction === "up" ? "↑" : metric.direction === "down" ? "↓" : "·";

  return (
    <div className="flex items-center justify-between rounded-xl border border-[#252e3e] bg-[#0b1018] px-2.5 py-2">
      <span className="text-[11px] text-darla-text-muted">{metric.label}</span>
      <span className={`font-mono text-[11px] ${toneClass}`}>
        {metric.start} → {metric.end} {arrow}
      </span>
    </div>
  );
}
