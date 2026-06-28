import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { CausalDrilldownMode, CausalGraph, CausalSelectionContext } from "../../data/causalModel";
import CausalWorkbench, { MODES } from "./CausalWorkbench";

type CausalDrilldownDrawerProps = {
  open: boolean;
  onClose: () => void;
  context: CausalSelectionContext | null;
  graph: CausalGraph | null;
};

export default function CausalDrilldownDrawer({
  open,
  onClose,
  context,
  graph,
}: CausalDrilldownDrawerProps) {
  const [mode, setMode] = useState<CausalDrilldownMode>("why");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !context || !graph) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#070b14]/95 backdrop-blur-sm">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-darla-border bg-darla-bg/90 px-5">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-sky-400 shadow-[0_0_18px_#38bdf8]" />
          <div>
            <h2 className="text-sm font-semibold text-darla-text">Causal drill-down</h2>
            <p className="text-[11px] text-darla-text-muted">{context.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                mode === m.id
                  ? "border-sky-500/50 bg-sky-950/50 text-white"
                  : "border-transparent text-darla-text-muted hover:border-darla-border hover:text-darla-text"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-darla-text-muted hover:bg-darla-panel hover:text-darla-text"
        >
          <X size={18} />
        </button>
      </header>

      <CausalWorkbench
        context={context}
        graph={graph}
        mode={mode}
        onModeChange={setMode}
        showModeToolbar={false}
        padded={false}
      />
    </div>
  );
}
