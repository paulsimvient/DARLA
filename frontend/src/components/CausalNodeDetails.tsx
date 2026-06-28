import { X } from "lucide-react";
import type { CausalNode } from "../data/mockScenario";
import { getCausalNodeById } from "../data/mockScenario";

type CausalNodeDetailsProps = {
  node: CausalNode;
  onClose: () => void;
};

export default function CausalNodeDetails({ node, onClose }: CausalNodeDetailsProps) {
  const upstream = node.upstream
    .map((id) => getCausalNodeById(id))
    .filter(Boolean) as CausalNode[];
  const downstream = node.downstream
    .map((id) => getCausalNodeById(id))
    .filter(Boolean) as CausalNode[];

  return (
    <aside className="flex w-64 shrink-0 flex-col rounded-lg border border-darla-border bg-darla-panel-elevated">
      <header className="flex items-center justify-between border-b border-darla-border px-3 py-2">
        <h3 className="text-xs font-semibold text-darla-text">Node Details</h3>
        <button type="button" onClick={onClose} className="text-darla-text-secondary hover:text-darla-text">
          <X size={16} />
        </button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-3 text-xs">
        <Field label="Label" value={node.label} />
        <Field label="Type" value={node.type} capitalize />
        <Field label="Confidence" value={`${Math.round(node.confidence * 100)}%`} />

        {node.evidence ? <Field label="Evidence" value={node.evidence} /> : null}

        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-darla-text-secondary">
            Upstream Links
          </div>
          {upstream.length === 0 ? (
            <span className="text-darla-text-secondary">None</span>
          ) : (
            <ul className="space-y-1">
              {upstream.map((n) => (
                <li key={n.id} className="text-darla-text-secondary">← {n.label}</li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-darla-text-secondary">
            Downstream Links
          </div>
          {downstream.length === 0 ? (
            <span className="text-darla-text-secondary">None</span>
          ) : (
            <ul className="space-y-1">
              {downstream.map((n) => (
                <li key={n.id} className="text-darla-text-secondary">→ {n.label}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}

function Field({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-darla-text-secondary">{label}</div>
      <div className={`mt-0.5 text-darla-text ${capitalize ? "capitalize" : ""}`}>{value}</div>
    </div>
  );
}
