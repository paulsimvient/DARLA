import MapPanel from "../../MapPanel";
import type { MapEntity, RelationshipEdge } from "../../types";

type BranchDualMapProps = {
  tick: number;
  baselineEntities: MapEntity[];
  branchEntities: MapEntity[];
  relationships: RelationshipEdge[];
  baselineLabel: string;
  branchLabel: string;
};

export default function BranchDualMap({
  tick,
  baselineEntities,
  branchEntities,
  relationships,
  baselineLabel,
  branchLabel,
}: BranchDualMapProps) {
  return (
    <div className="grid h-full min-h-0 grid-cols-2 gap-2">
      <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-sky-500/30 bg-[#0b111a]">
        <div className="border-b border-sky-500/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
          {baselineLabel} · T+{tick}
        </div>
        <MapPanel
          className="min-h-0 flex-1 rounded-none border-0"
          entities={baselineEntities}
          relationships={relationships}
          currentTick={tick}
          showChrome={false}
        />
      </div>
      <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-violet-500/30 bg-[#0b111a]">
        <div className="border-b border-violet-500/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
          {branchLabel} · T+{tick}
        </div>
        <MapPanel
          className="min-h-0 flex-1 rounded-none border-0"
          entities={branchEntities}
          relationships={relationships}
          currentTick={tick}
          showChrome={false}
        />
      </div>
    </div>
  );
}
