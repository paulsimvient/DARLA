import type { CausalDrilldownMode, CausalNode, CausalSelectionContext } from "../../data/causalModel";
import Badge from "../Badge";
import { CausalWireframeIcon } from "./causalIcons";
import { layerLabels } from "./causalStyles";

type EvidenceTracePanelProps = {
  context: CausalSelectionContext;
  selectedNode: CausalNode | null;
  mode: CausalDrilldownMode;
};

export default function EvidenceTracePanel({ context, selectedNode, mode }: EvidenceTracePanelProps) {
  const node = selectedNode;

  if (!node) {
    return (
      <aside className="darla-panel flex h-full w-full flex-col p-5">
        <p className="text-xs text-darla-text-muted">
          Select a causal node on the canvas or from the library to inspect evidence and trace.
        </p>
      </aside>
    );
  }

  return (
    <aside className="darla-panel flex h-full w-full flex-col overflow-hidden">
      <header className="border-b border-darla-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-darla-border bg-darla-bg">
            <CausalWireframeIcon type={node.type} size={18} className="text-darla-text-secondary" />
          </span>
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-darla-text">Inspector</h3>
            <p className="truncate text-[10px] text-darla-text-muted">{node.id}</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <Badge tone="neutral">{layerLabels[node.type]}</Badge>
          {node.confidence != null ? (
            <Badge tone="blue">{Math.round(node.confidence * 100)}% conf</Badge>
          ) : null}
        </div>
      </header>

      <div className="darla-scroll flex-1 space-y-4 overflow-y-auto p-4 text-xs">
        <InspectorField label="Node name" value={node.label} />
        <InspectorField label="Subtitle" value={node.subtitle ?? layerLabels[node.type]} />

        <div>
          <span className="mb-1.5 block text-[11px] font-medium text-darla-text-muted">Mode · {modeLabel(mode)}</span>
          <div className="rounded-lg border border-darla-border bg-darla-bg p-3 text-[11px] leading-relaxed text-darla-text-secondary">
            {modeContent(mode, node, context)}
          </div>
        </div>

        {node.detail ? (
          <div>
            <span className="mb-1.5 block text-[11px] font-medium text-darla-text-muted">Explanation</span>
            <p className="text-[11px] leading-relaxed text-darla-text-secondary">{node.detail}</p>
          </div>
        ) : null}

        {node.time ? <InspectorField label="Time" value={node.time} mono /> : null}

        <div>
          <span className="mb-1.5 block text-[11px] font-medium text-darla-text-muted">Causal window</span>
          <div className="rounded-lg border border-darla-border bg-darla-bg p-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-darla-panel-elevated">
              <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-darla-blue to-darla-orange" />
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-darla-text-muted">
              {context.tick != null
                ? `T+00 signal → T+${Math.max(0, context.tick - 10)} inference → T+${context.tick} decision point`
                : "T+00 signal → T+12 inference → T+22 decision point → T+38 projected outcome"}
            </p>
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-[11px] font-medium text-darla-text-muted">Recommended COA</span>
          <div className="rounded-lg border border-darla-border bg-darla-bg p-3">
            <h4 className="text-[11px] font-semibold text-darla-text">COA B + reroute overlay</h4>
            <p className="mt-1 text-[10px] leading-relaxed text-darla-text-muted">
              Harden the coordination node, then reroute ISR if launch risk remains above threshold.
            </p>
          </div>
        </div>
      </div>

      <footer className="flex flex-col gap-2 border-t border-darla-border p-4">
        <button type="button" className="darla-btn-primary w-full py-2">
          Push to map
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="darla-btn py-2">
            Explain
          </button>
          <button type="button" className="darla-btn py-2">
            Simulate
          </button>
        </div>
      </footer>
    </aside>
  );
}

function modeLabel(mode: CausalDrilldownMode): string {
  switch (mode) {
    case "why":
      return "Why?";
    case "whatif":
      return "What if?";
    case "evidence":
      return "Evidence";
    case "decision":
      return "Decision Trace";
  }
}

function modeContent(mode: CausalDrilldownMode, node: CausalNode, context: CausalSelectionContext): string {
  if (mode === "whatif") {
    return "Test a COA by modifying node probabilities, disabling edges, or injecting simulated events from the co-sim engine.";
  }
  if (mode === "evidence") {
    return node.detail ?? "Show source observations, model outputs, timestamps, and confidence supporting each causal link.";
  }
  if (mode === "decision") {
    return `observation → validation → inference → solver payload → COA ranking → simulated effect. ${context.subtitle ?? ""}`;
  }
  return node.detail ?? "Explain the causal path from the selected map feature to mission outcome.";
}

function InspectorField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium text-darla-text-muted">{label}</span>
      <div
        className={`darla-input py-2 text-[11px] ${mono ? "font-mono" : ""}`}
        aria-readonly
      >
        {value}
      </div>
    </label>
  );
}
