import { Activity, ArrowRight, ShieldCheck } from "lucide-react";
import type { ActiveCausalChain } from "../../utils/moduleGraphRealism";

type ActiveCausalChainRibbonProps = {
  chain: ActiveCausalChain;
  currentTick: number;
};

export default function ActiveCausalChainRibbon({ chain, currentTick }: ActiveCausalChainRibbonProps) {
  return (
    <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 rounded-xl border border-darla-border bg-darla-panel/92 p-3 shadow-xl backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-darla-text-muted">
          <Activity size={13} strokeWidth={1.5} /> Active causal chain · T+{currentTick}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-darla-text-muted">
          Confidence <span className="font-semibold text-darla-text">{Math.round(chain.confidence * 100)}%</span>
          {chain.recommendedAction ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-sky-800/60 bg-sky-950/50 px-2 py-0.5 text-sky-300">
              <ShieldCheck size={11} strokeWidth={1.5} /> {chain.recommendedAction}
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-darla-text-secondary">
        {chain.nodes.map((node, index) => (
          <span key={`${node}-${index}`} className="flex items-center gap-1.5">
            <span className="rounded-md border border-darla-border bg-darla-bg px-2 py-1 capitalize text-darla-text">
              {node}
            </span>
            {index < chain.nodes.length - 1 ? <ArrowRight size={12} className="text-darla-text-muted" /> : null}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-darla-text-muted">{chain.summary}</p>
    </div>
  );
}
