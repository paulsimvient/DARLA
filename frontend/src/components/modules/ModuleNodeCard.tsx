import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Trash2 } from "lucide-react";
import type { SimModule } from "../../data/mockScenario";
import { ModuleWireframeIcon } from "./moduleIcons";

const statusColors: Record<SimModule["validationStatus"], string> = {
  pass: "#22c55e",
  warn: "#f59e0b",
  fail: "#ef4444",
};

export type ModuleNodeData = {
  module: SimModule;
  onRemove?: (id: string) => void;
};

export type ModuleFlowNode = Node<ModuleNodeData, "module">;

export default function ModuleNodeCard({ data, selected }: NodeProps<ModuleFlowNode>) {
  const { module, onRemove } = data;

  return (
    <div
      className={`group relative w-[112px] rounded-xl border bg-darla-panel transition-all ${
        selected
          ? "border-darla-blue ring-2 ring-darla-blue/25"
          : "border-darla-border hover:border-darla-border-subtle"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        title="Input — receive connections here"
        className="!-left-1 !h-2 !w-2 !border-zinc-500 !bg-zinc-700 hover:!border-sky-400 hover:!bg-sky-900"
      />
      <div className="w-full p-2.5 text-left">
        <div className="flex items-start gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-darla-border bg-darla-bg">
            <ModuleWireframeIcon module={module} size={16} className="text-darla-text-secondary" />
          </span>
          <span className="min-w-0 flex-1">
            <div className="truncate text-[10px] font-semibold text-darla-text">{module.name}</div>
            <div className="truncate text-[9px] text-darla-text-muted">{module.category}</div>
          </span>
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
        className="!-right-1 !h-2 !w-2 !border-zinc-500 !bg-zinc-700 hover:!border-sky-400 hover:!bg-sky-900"
      />
    </div>
  );
}
