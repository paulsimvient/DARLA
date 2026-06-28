import { Link } from "react-router-dom";

export default function CausalPreviewCard() {
  return (
    <Link
      to="/causal"
      className="group flex flex-col rounded-xl border border-darla-border bg-darla-panel p-3 transition-all hover:border-darla-border-subtle hover:bg-darla-panel-elevated"
    >
      <div className="mb-2 flex h-10 items-center justify-center opacity-60 group-hover:opacity-100">
        <svg viewBox="0 0 80 40" className="h-full w-full">
          <circle cx="10" cy="20" r="4" fill="#3b82f6" />
          <circle cx="30" cy="12" r="3" fill="#22c55e" />
          <circle cx="30" cy="28" r="3" fill="#ef4444" />
          <circle cx="50" cy="20" r="4" fill="#3b82f6" />
          <circle cx="68" cy="20" r="4" fill="#f59e0b" />
          <line x1="14" y1="20" x2="26" y2="14" stroke="#3f3f46" strokeWidth="1.5" />
          <line x1="14" y1="20" x2="26" y2="26" stroke="#3f3f46" strokeWidth="1.5" />
          <line x1="34" y1="16" x2="46" y2="19" stroke="#3f3f46" strokeWidth="1.5" />
          <line x1="54" y1="20" x2="64" y2="20" stroke="#3f3f46" strokeWidth="1.5" />
        </svg>
      </div>
      <div className="text-xs font-medium text-darla-text">Causal graph</div>
      <div className="mt-0.5 text-[10px] leading-snug text-darla-text-muted">Cause-and-effect analysis</div>
    </Link>
  );
}
