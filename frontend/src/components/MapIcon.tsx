import type { MapEntity } from "../data/mockScenario";
import MapEntityMarkerBadge, { mockEntityKind } from "./MapEntityMarkerBadge";

type MapIconProps = {
  entity: MapEntity;
  selected?: boolean;
  onClick?: () => void;
};

export default function MapIcon({ entity, selected, onClick }: MapIconProps) {
  const kind = mockEntityKind(entity.type);
  const isDestroyed = entity.status === "destroyed";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-105 ${
        selected ? "z-20 scale-105" : "z-10"
      }`}
      style={{ left: `${entity.x}%`, top: `${entity.y}%` }}
      title={entity.label}
    >
      <MapEntityMarkerBadge
        kind={kind}
        side={entity.side}
        label={entity.label}
        selected={selected}
        destroyed={isDestroyed}
      />
    </button>
  );
}

export { sideAccentColor as sideColors } from "../lib/mapEntityMarkers";
