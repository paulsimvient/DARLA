import type { COA } from "../data/mockScenario";
import Badge, { riskTone } from "./Badge";
import DrilldownButton from "./DrilldownButton";

const rankAccent: Record<number, string> = {
  1: "border-blue-500/30 bg-blue-500/5",
  2: "border-emerald-500/30 bg-emerald-500/5",
  3: "border-red-500/30 bg-red-500/5",
};

type COACardProps = {
  coa: COA;
  onOpenDetails: (coa: COA) => void;
};

export default function COACard({ coa, onOpenDetails }: COACardProps) {
  const accent = rankAccent[coa.rank] ?? rankAccent[1];

  return (
    <div className={`rounded-xl border p-3 transition-colors hover:bg-darla-panel-elevated/50 ${accent}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-medium text-darla-text-muted">{coa.name}</div>
          <div className="mt-0.5 text-sm font-semibold text-darla-text">{coa.subtitle}</div>
        </div>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-darla-panel text-xs font-bold text-darla-text-secondary">
          {coa.rank}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="text-2xl font-semibold tabular-nums tracking-tight text-darla-text">
            {coa.successProbability}%
          </div>
          <div className="text-[10px] text-darla-text-muted">Success probability</div>
        </div>
        <Badge tone={riskTone(coa.risk)}>{coa.risk} risk</Badge>
      </div>

      <DrilldownButton
        label="Open details"
        onClick={() => onOpenDetails(coa)}
        className="mt-3"
      />
    </div>
  );
}
