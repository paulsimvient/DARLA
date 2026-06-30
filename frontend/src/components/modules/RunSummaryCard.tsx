import type { ReactNode } from "react";
import { CheckCircle2, FileText, GitBranch, Target } from "lucide-react";
import type { RunModuleSummary } from "../../utils/moduleGraphRealism";

type RunSummaryCardProps = {
  summary: RunModuleSummary;
  replayHash?: string;
};

export default function RunSummaryCard({ summary, replayHash }: RunSummaryCardProps) {
  return (
    <div className="rounded-xl border border-darla-border bg-darla-panel p-3 text-xs">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-darla-text-muted">Run summary</h3>
        <span className="rounded-md border border-darla-border bg-darla-bg px-2 py-0.5 text-[10px] text-darla-text-muted">
          {replayHash ? `hash ${replayHash.slice(0, 10)}` : "no replay hash"}
        </span>
      </div>
      <div className="space-y-2">
        <SummaryLine icon={<Target size={13} />} label="Outcome" value={summary.outcome} />
        <SummaryLine icon={<GitBranch size={13} />} label="Causal path" value={summary.primaryCausalPath} />
        <SummaryLine icon={<CheckCircle2 size={13} />} label="Best COA" value={summary.bestCoa} />
        <SummaryLine icon={<FileText size={13} />} label="Evidence" value={`${summary.estimatedImprovement} · ${summary.evidenceConfidence}`} />
      </div>
    </div>
  );
}

function SummaryLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-2 rounded-lg border border-darla-border bg-darla-bg/70 px-2.5 py-2">
      <span className="mt-0.5 text-darla-text-muted">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[10px] uppercase tracking-[0.16em] text-darla-text-muted">{label}</span>
        <span className="block truncate text-[11px] text-darla-text">{value}</span>
      </span>
    </div>
  );
}
