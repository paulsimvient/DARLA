import { Crosshair, Minus, Plus } from "lucide-react";
import { useState } from "react";
import type { MapEntity } from "../data/mockScenario";
import { mapEntities } from "../data/mockScenario";
import MapIcon from "./MapIcon";
import MapLayerControls, {
  DEFAULT_MAP_LAYER_VISIBILITY,
  type MapLayerVisibility,
} from "./MapLayerControls";

type OperationalMapProps = {
  entities?: MapEntity[];
  selectedId?: string | null;
  onSelectEntity?: (id: string | null) => void;
  fullScreen?: boolean;
};

export default function OperationalMap({
  entities = mapEntities,
  selectedId,
  onSelectEntity,
  fullScreen = false,
}: OperationalMapProps) {
  const [zoom, setZoom] = useState(1);
  const [layerVisibility, setLayerVisibility] = useState<MapLayerVisibility>(
    DEFAULT_MAP_LAYER_VISIBILITY,
  );

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-darla-border bg-[#0a0a0c] ${
        fullScreen ? "h-full min-h-0 flex-1" : "min-h-0 flex-1"
      }`}
    >
      <div
        className="absolute inset-0 origin-center transition-transform duration-200"
        style={{
          transform: `scale(${zoom})`,
          background: `
            radial-gradient(ellipse 80% 60% at 50% 40%, #1a1a22 0%, #0a0a0c 70%),
            linear-gradient(180deg, #121218 0%, #0a0a0c 100%)
          `,
        }}
      >
        {/* Subtle landmass hints */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 35% 28% at 30% 55%, rgba(45,55,45,0.35) 0%, transparent 70%),
              radial-gradient(ellipse 30% 22% at 72% 48%, rgba(55,45,40,0.3) 0%, transparent 70%),
              radial-gradient(ellipse 45% 18% at 50% 78%, rgba(25,35,50,0.45) 0%, transparent 60%)
            `,
          }}
        />

        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-80">
          <defs>
            <marker id="arrow-blue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6" fill="#3b82f6" />
            </marker>
          </defs>
          <circle cx="22%" cy="48%" r="11%" fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 4" opacity="0.25" />
          <circle cx="72%" cy="42%" r="9%" fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="4 4" opacity="0.22" />
          <line x1="22%" y1="48%" x2="45%" y2="55%" stroke="#3b82f6" strokeWidth="1" strokeDasharray="6 4" markerEnd="url(#arrow-blue)" opacity="0.45" />
          <ellipse cx="72%" cy="50%" rx="12%" ry="9%" fill="rgba(239,68,68,0.06)" stroke="#ef4444" strokeWidth="1" strokeDasharray="4 3" opacity="0.35" />
        </svg>

        {entities.map((entity) => (
          <MapIcon
            key={entity.id}
            entity={entity}
            selected={selectedId === entity.id}
            onClick={() => onSelectEntity?.(selectedId === entity.id ? null : entity.id)}
          />
        ))}
      </div>

      <MapLayerControls visibility={layerVisibility} onChange={setLayerVisibility} />

      <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md border border-darla-border/80 bg-darla-panel/80 text-[10px] font-semibold text-darla-text-muted backdrop-blur-sm">
        N
      </div>

      <div className="absolute right-3 top-12 flex flex-col gap-1">
        {[
          { icon: Plus, action: () => setZoom((z) => Math.min(z + 0.15, 2)) },
          { icon: Minus, action: () => setZoom((z) => Math.max(z - 0.15, 0.6)) },
          { icon: Crosshair, action: () => setZoom(1) },
        ].map(({ icon: Icon, action }, i) => (
          <button
            key={i}
            type="button"
            onClick={action}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-darla-border/80 bg-darla-panel/90 text-darla-text-secondary backdrop-blur-sm transition-colors hover:bg-darla-panel-elevated hover:text-darla-text"
          >
            <Icon size={14} />
          </button>
        ))}
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-2 rounded-md border border-darla-border/80 bg-darla-panel/90 px-2.5 py-1 text-[10px] text-darla-text-muted backdrop-blur-sm">
        <div className="h-px w-10 bg-darla-text-muted" />
        10 km
      </div>
    </div>
  );
}
