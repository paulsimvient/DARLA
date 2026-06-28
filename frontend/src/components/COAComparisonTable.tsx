import type { COA } from "../data/mockScenario";
import Badge, { riskTone } from "./Badge";

type COAComparisonTableProps = {
  coas: COA[];
  onSelectCoa?: (coa: COA) => void;
  selectedId?: string | null;
};

export default function COAComparisonTable({ coas, onSelectCoa, selectedId }: COAComparisonTableProps) {
  return (
    <div className="darla-panel overflow-hidden">
      <table className="w-full text-left text-[12px]">
        <thead>
          <tr className="border-b border-darla-border bg-darla-surface text-[11px] font-medium text-darla-text-muted">
            <th className="px-4 py-2.5">COA</th>
            <th className="px-4 py-2.5">Success</th>
            <th className="px-4 py-2.5">Risk</th>
            <th className="px-4 py-2.5">Time</th>
            <th className="px-4 py-2.5">Resources</th>
            <th className="px-4 py-2.5">Confidence</th>
            <th className="px-4 py-2.5">Recommended</th>
          </tr>
        </thead>
        <tbody>
          {coas.map((coa) => (
            <tr
              key={coa.id}
              onClick={() => onSelectCoa?.(coa)}
              className={`cursor-pointer border-b border-darla-border/50 transition-colors hover:bg-darla-panel-elevated/50 ${
                selectedId === coa.id ? "bg-darla-blue-soft/30 ring-1 ring-inset ring-darla-blue/30" : ""
              }`}
            >
              <td className="px-4 py-3">
                <div className="font-medium text-darla-text">{coa.subtitle}</div>
                <div className="text-[11px] text-darla-text-muted">{coa.name}</div>
              </td>
              <td className="px-4 py-3 font-semibold tabular-nums text-darla-text">{coa.successProbability}%</td>
              <td className="px-4 py-3">
                <Badge tone={riskTone(coa.risk)}>{coa.risk}</Badge>
              </td>
              <td className="px-4 py-3 text-darla-text-secondary">{coa.expectedTime}</td>
              <td className="px-4 py-3 capitalize text-darla-text-secondary">{coa.resourceDemand}</td>
              <td className="px-4 py-3 tabular-nums text-darla-text-secondary">
                {Math.round(coa.confidence * 100)}%
              </td>
              <td className="px-4 py-3">
                {coa.recommended ? (
                  <Badge tone="green">Yes</Badge>
                ) : (
                  <span className="text-darla-text-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
