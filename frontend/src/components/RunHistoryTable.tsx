import type { SimulationRun } from "../data/mockScenario";
import Badge from "./Badge";

type RunHistoryTableProps = {
  runs: SimulationRun[];
};

function statusTone(status: SimulationRun["status"]) {
  const map = {
    running: "green" as const,
    complete: "blue" as const,
    failed: "red" as const,
    branch: "orange" as const,
  };
  return map[status];
}

export default function RunHistoryTable({ runs }: RunHistoryTableProps) {
  return (
    <div className="darla-panel overflow-hidden">
      <table className="w-full text-left text-[12px]">
        <thead>
          <tr className="border-b border-darla-border bg-darla-surface text-[11px] font-medium text-darla-text-muted">
            <th className="px-4 py-2.5">Run ID</th>
            <th className="px-4 py-2.5">Scenario</th>
            <th className="px-4 py-2.5">COA</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5">Start</th>
            <th className="px-4 py-2.5">Duration</th>
            <th className="px-4 py-2.5">Success</th>
            <th className="px-4 py-2.5">Evidence</th>
            <th className="px-4 py-2.5">Actions</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr
              key={run.id}
              className="border-b border-darla-border/50 transition-colors hover:bg-darla-panel-elevated/40"
            >
              <td className="px-4 py-3 font-mono text-[11px] font-medium text-darla-text">{run.id}</td>
              <td className="px-4 py-3 text-darla-text-secondary">{run.scenario}</td>
              <td className="px-4 py-3 text-darla-text">{run.coa}</td>
              <td className="px-4 py-3">
                <Badge tone={statusTone(run.status)}>{run.status}</Badge>
              </td>
              <td className="px-4 py-3 font-mono text-[11px] text-darla-text-muted">{run.startTime}</td>
              <td className="px-4 py-3 font-mono text-[11px] text-darla-text-muted">{run.duration}</td>
              <td className="px-4 py-3 font-semibold tabular-nums text-darla-text">{run.successProbability}%</td>
              <td className="px-4 py-3 text-darla-text-muted">{run.evidence}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {(["Replay", "Compare", "Export", "Branch"] as const).map((action) => (
                    <button key={action} type="button" className="darla-btn !px-2 !py-0.5 !text-[10px]">
                      {action}
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
