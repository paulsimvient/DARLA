import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { CausalNode } from "../../data/causalModel";
import { CausalWireframeIcon } from "./causalIcons";
import { layerLabels, nodeTypeAccent } from "./causalStyles";

export type CausalNodeData = {
  causal: CausalNode;
  selected?: boolean;
};

export type CausalFlowNode = Node<CausalNodeData, "causal">;

export default function CausalNodeCard({ data, selected }: NodeProps<CausalFlowNode>) {
  const node = data.causal;

  return (
    <div
      className={`w-[112px] rounded-xl border bg-darla-panel transition-all ${
        selected
          ? "border-darla-blue ring-2 ring-darla-blue/25"
          : "border-darla-border hover:border-darla-border-subtle"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!-left-1 !h-1.5 !w-1.5 !border-zinc-600 !bg-zinc-800"
      />
      <div className="w-full p-2.5 text-left">
        <div className="flex items-start gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-darla-border bg-darla-bg">
            <CausalWireframeIcon type={node.type} size={16} className="text-darla-text-secondary" />
          </span>
          <span className="min-w-0 flex-1">
            <div className="truncate text-[10px] font-semibold text-darla-text">{node.label}</div>
            <div className="truncate text-[9px] text-darla-text-muted">
              {node.subtitle ?? layerLabels[node.type]}
            </div>
          </span>
        </div>
        <div
          className="mt-2 h-0.5 w-full rounded-full"
          style={{ background: nodeTypeAccent[node.type] }}
        />
        {node.confidence != null ? (
          <div className="mt-1.5 text-[9px] tabular-nums text-darla-text-muted">
            {Math.round(node.confidence * 100)}% conf
          </div>
        ) : null}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!-right-1 !h-1.5 !w-1.5 !border-zinc-600 !bg-zinc-800"
      />
    </div>
  );
}
