import { Link } from "react-router-dom";

export default function ModulePreviewCard() {
  return (
    <Link
      to="/modules"
      className="group flex flex-col rounded-xl border border-darla-border bg-darla-panel p-3 transition-all hover:border-darla-border-subtle hover:bg-darla-panel-elevated"
    >
      <div className="mb-2 flex h-10 items-center justify-center opacity-60 group-hover:opacity-100">
        <svg viewBox="0 0 80 40" className="h-full w-full">
          <rect x="4" y="14" width="18" height="12" rx="2" fill="#18181b" stroke="#22c55e" strokeWidth="1.25" />
          <rect x="30" y="14" width="18" height="12" rx="2" fill="#18181b" stroke="#3b82f6" strokeWidth="1.25" />
          <rect x="56" y="14" width="18" height="12" rx="2" fill="#18181b" stroke="#f59e0b" strokeWidth="1.25" />
          <line x1="22" y1="20" x2="30" y2="20" stroke="#3f3f46" strokeWidth="1.25" />
          <line x1="48" y1="20" x2="56" y2="20" stroke="#3f3f46" strokeWidth="1.25" />
        </svg>
      </div>
      <div className="text-xs font-medium text-darla-text">Module builder</div>
      <div className="mt-0.5 text-[10px] leading-snug text-darla-text-muted">Compose simulation blocks</div>
    </Link>
  );
}
