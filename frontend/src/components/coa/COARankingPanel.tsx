import type { CourseOfAction } from "../../types";
import {
  coaScoreClass,
  coaScoreTone,
  coaSummary,
  formatCoaAction,
} from "../../utils/coaHelpers";

type COARankingPanelProps = {
  coas: CourseOfAction[];
  selectedId: number | null;
  onSelect: (coa: CourseOfAction) => void;
};

export default function COARankingPanel({ coas, selectedId, onSelect }: COARankingPanelProps) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-darla-border bg-darla-panel/90 shadow-lg">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-darla-border bg-darla-surface/80 px-4">
        <div>
          <div className="text-[13px] font-bold text-darla-text">COA Ranking</div>
          <div className="text-[11px] text-darla-text-muted">Recommended actions only</div>
        </div>
        <span className="text-[11px] text-darla-text-muted">{coas.length} found</span>
      </header>

      <div className="darla-scroll min-h-0 flex-1 overflow-auto p-2.5">
        {coas.length === 0 ? (
          <div className="p-4 text-xs text-darla-text-muted">
            No COA recommendations yet. Run the simulation to populate the decision board.
          </div>
        ) : (
          coas.map((coa, index) => {
            const tone = coaScoreTone(coa.score);
            const selected = selectedId === coa.id;
            return (
              <button
                key={coa.id}
                type="button"
                onClick={() => onSelect(coa)}
                className={`mb-2.5 w-full rounded-2xl border p-3 text-left transition-colors ${
                  selected
                    ? "border-sky-400/60 bg-gradient-to-b from-sky-950/40 to-darla-panel"
                    : "border-darla-border bg-darla-panel hover:border-darla-border-subtle hover:bg-darla-panel-elevated"
                }`}
              >
                <div className="grid grid-cols-[auto_1fr_auto] items-start gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-darla-border bg-darla-bg text-[13px] font-black text-sky-200">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-bold text-darla-text">
                      {formatCoaAction(coa.action)}
                    </div>
                    <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-darla-text-muted">
                      {coaSummary(coa, index + 1)}
                    </div>
                  </div>
                  <span className={`font-mono text-[15px] font-extrabold ${coaScoreClass(tone)}`}>
                    {coa.score.toFixed(2)}
                  </span>
                </div>
                <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                  <Metric label="Gain" value={coa.expected_mission_gain.toFixed(3)} />
                  <Metric label="Risk" value={coa.risk.toFixed(3)} />
                  <Metric label="Cost" value={String(coa.cost)} />
                  <Metric label="Time" value={`T+${coa.proposed_tick}`} />
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-darla-border bg-darla-bg px-2 py-1.5">
      <div className="text-[10px] text-darla-text-muted">{label}</div>
      <div className="text-[11px] font-semibold text-darla-text">{value}</div>
    </div>
  );
}
