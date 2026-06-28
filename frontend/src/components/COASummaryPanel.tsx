import Badge from "./Badge";
import CausalPreviewCard from "./CausalPreviewCard";
import ModulePreviewCard from "./ModulePreviewCard";
import { useSimulation } from "../context/SimulationContext";
import type { CourseOfAction } from "../types";

function statusTone(status: string) {
  if (status === "executed" || status === "approved") return "green" as const;
  if (status === "recommended" || status === "proposed") return "blue" as const;
  if (status === "rejected") return "red" as const;
  return "neutral" as const;
}

function riskFromScore(risk: number): "low" | "medium" | "high" {
  if (risk >= 0.6) return "high";
  if (risk >= 0.35) return "medium";
  return "low";
}

const rankAccent: Record<number, string> = {
  1: "border-blue-500/40 bg-blue-500/5",
  2: "border-emerald-500/30 bg-emerald-500/5",
  3: "border-red-500/30 bg-red-500/5",
};

export default function COASummaryPanel() {
  const { currentFrame, dashboard } = useSimulation();
  const recommendations = currentFrame?.coa_recommendations ?? [];
  const activeCoa = currentFrame?.active_coa ?? null;
  const coaLog = dashboard?.coa_log ?? [];
  const ranked = (recommendations.length > 0 ? recommendations : coaLog.slice(-3).reverse()).slice(0, 3);

  return (
    <aside className="darla-scroll flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-l border-darla-border bg-darla-surface p-4">
      <div>
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-darla-text-secondary">
          Course of Actions (Ranked)
        </h2>
      </div>

      {activeCoa ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
            Active COA
          </div>
          <div className="mt-1 text-sm font-semibold text-darla-text">{activeCoa.action}</div>
        </div>
      ) : null}

      <div className="space-y-2">
        {ranked.length === 0 ? (
          <div className="rounded-xl border border-darla-border bg-darla-panel p-4 text-xs text-darla-text-muted">
            Waiting for agent COA recommendations…
          </div>
        ) : (
          ranked.map((coa, index) => (
            <RankedCoaCard key={coa.id} coa={coa} rank={index + 1} />
          ))
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <CausalPreviewCard />
        <ModulePreviewCard />
      </div>
    </aside>
  );
}

function RankedCoaCard({ coa, rank }: { coa: CourseOfAction; rank: number }) {
  const successPct = Math.round(Math.max(0, Math.min(100, coa.score * 100)));
  const risk = riskFromScore(coa.risk);
  const accent = rankAccent[rank] ?? rankAccent[1];

  return (
    <div className={`rounded-xl border p-3 ${accent}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-medium text-darla-text-muted">COA {rank}</div>
          <div className="mt-0.5 text-sm font-semibold text-darla-text">{coa.action}</div>
        </div>
        <Badge tone={statusTone(coa.status)}>{coa.status}</Badge>
      </div>

      <div className="mt-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-semibold tabular-nums text-darla-text">{successPct}%</div>
            <div className="text-[10px] text-darla-text-muted">Success probability</div>
          </div>
          <Badge tone={risk === "high" ? "red" : risk === "medium" ? "orange" : "green"}>
            {risk} risk
          </Badge>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-darla-border">
          <div
            className={`h-full rounded-full ${
              successPct >= 65 ? "bg-emerald-500" : successPct >= 45 ? "bg-amber-500" : "bg-red-500"
            }`}
            style={{ width: `${successPct}%` }}
          />
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-[11px] text-darla-text-secondary">{coa.rationale}</p>
    </div>
  );
}
