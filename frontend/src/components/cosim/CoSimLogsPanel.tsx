import type { CoSimLogEntry } from "../../data/mockCoSim";

const levelColors: Record<CoSimLogEntry["level"], string> = {
  info: "text-darla-text-secondary",
  warn: "text-darla-orange",
  success: "text-darla-green",
  error: "text-darla-red",
};

type CoSimLogsPanelProps = {
  logs: CoSimLogEntry[];
};

export default function CoSimLogsPanel({ logs }: CoSimLogsPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-darla-border bg-darla-bg">
      <header className="flex items-center justify-between border-b border-darla-border px-3 py-1.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-darla-text-secondary">
          Execution Logs
        </h3>
        <span className="font-mono text-[9px] text-darla-text-secondary">{logs.length} messages</span>
      </header>
      <div className="flex-1 overflow-y-auto p-2 font-mono text-[10px] leading-relaxed">
        {logs.length === 0 ? (
          <p className="text-darla-text-secondary">Run a scenario with FMUs to populate co-simulation logs.</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex gap-2 py-0.5">
              <span className="shrink-0 text-darla-text-secondary/60">{log.timestamp}</span>
              <span className={`shrink-0 uppercase ${levelColors[log.level]}`}>[{log.level}]</span>
              <span className="text-darla-text-secondary">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
