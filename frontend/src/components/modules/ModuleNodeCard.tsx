import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Activity, Trash2 } from "lucide-react";
import type { SimModule } from "../../types/moduleCanvas";
import { moduleHealthAccent, moduleHealthTone, type ModuleRuntimeState } from "../../utils/moduleGraphRealism";
import { ModuleWireframeIcon } from "./moduleIcons";

const statusColors: Record<SimModule["validationStatus"], string> = {
  pass: "#22c55e",
  warn: "#f59e0b",
  fail: "#ef4444",
};

export type ModuleNodeData = {
  module: SimModule;
  runtime: ModuleRuntimeState;
  onRemove?: (id: string) => void;
};

export type ModuleFlowNode = Node<ModuleNodeData, "module">;

export default function ModuleNodeCard({ data, selected }: NodeProps<ModuleFlowNode>) {
  const { module, runtime, onRemove } = data;
  const accent = moduleHealthAccent(runtime.health);

  return (
    <div
      className={`group relative w-[172px] rounded-xl border transition-all ${moduleHealthTone(runtime.health)} ${
        selected ? "ring-2 ring-darla-blue/30" : "hover:border-darla-border-subtle"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        title="Input — receive connections here"
        className="!-left-1 !h-2.5 !w-2.5 !border-zinc-500 !bg-zinc-800 hover:!border-sky-400 hover:!bg-sky-900"
      />
      <div className="w-full p-3 text-left">
        <div className="flex items-start gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-darla-border bg-darla-bg">
            <ModuleWireframeIcon module={module} size={17} className="text-darla-text-secondary" />
          </span>
          <span className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold capitalize text-darla-text">{module.name}</div>
            <div className="truncate text-[9px] text-darla-text-muted">{module.category}</div>
          </span>
          <span className="mt-0.5 h-2.5 w-2.5 rounded-full" style={{ background: accent }} title={runtime.health} />
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {runtime.stateBadges.map((badge) => (
            <span
              key={badge}
              className="rounded-md border border-darla-border bg-darla-bg/80 px-1.5 py-0.5 text-[9px] capitalize text-darla-text-muted"
            >
              {badge}
            </span>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1 text-[9px] text-darla-text-muted">
          <span className="rounded-md border border-darla-border bg-darla-bg/70 px-1.5 py-1 capitalize">
            risk {runtime.risk}
          </span>
          <span className="rounded-md border border-darla-border bg-darla-bg/70 px-1.5 py-1 capitalize">
            {runtime.provenance}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-1 text-[9px] text-darla-text-muted">
          <Activity size={10} strokeWidth={1.5} />
          <span className="truncate">{runtime.currentRelevance}</span>
        </div>

        <div
          className="mt-2 h-0.5 w-full rounded-full"
          style={{ background: statusColors[module.validationStatus] }}
        />
      </div>
      {onRemove ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove(module.id);
          }}
          title="Remove from canvas"
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-darla-border bg-darla-panel text-darla-text-muted opacity-0 transition-opacity hover:text-darla-red group-hover:opacity-100"
        >
          <Trash2 size={10} strokeWidth={1.25} />
        </button>
      ) : null}
      <Handle
        type="source"
        position={Position.Right}
        title="Output — drag to an input to connect"
        className="!-right-1 !h-2.5 !w-2.5 !border-zinc-500 !bg-zinc-800 hover:!border-sky-400 hover:!bg-sky-900"
      />
    </div>
  );
}
