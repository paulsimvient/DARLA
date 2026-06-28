import { useState } from "react";
import { Layers } from "lucide-react";

export type MapLayerVisibility = {
  units: boolean;
  routes: boolean;
  riskZones: boolean;
  coaEffects: boolean;
};

export const DEFAULT_MAP_LAYER_VISIBILITY: MapLayerVisibility = {
  units: true,
  routes: true,
  riskZones: true,
  coaEffects: true,
};

type MapLayerControlsProps = {
  visibility: MapLayerVisibility;
  onChange: (visibility: MapLayerVisibility) => void;
};

export default function MapLayerControls({ visibility, onChange }: MapLayerControlsProps) {
  const [open, setOpen] = useState(false);

  const toggle = (key: keyof MapLayerVisibility) => {
    onChange({ ...visibility, [key]: !visibility[key] });
  };

  return (
    <div className="pointer-events-auto absolute left-3 top-3 z-10">
      <button
        type="button"
        className="darla-btn !bg-darla-panel/90 backdrop-blur-sm"
        onClick={() => setOpen((value) => !value)}
      >
        <Layers size={13} />
        Layers
      </button>
      {open ? (
        <div className="mt-2 w-52 rounded-lg border border-darla-border bg-darla-panel/95 p-3 text-[11px] shadow-xl backdrop-blur-sm">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-darla-text-muted">
            Map layers
          </div>
          <div className="space-y-2">
            <LayerToggle
              label="Units"
              checked={visibility.units}
              onChange={() => toggle("units")}
            />
            <LayerToggle
              label="Routes"
              checked={visibility.routes}
              onChange={() => toggle("routes")}
            />
            <LayerToggle
              label="Risk zones"
              checked={visibility.riskZones}
              onChange={() => toggle("riskZones")}
            />
            <LayerToggle
              label="COA effects"
              checked={visibility.coaEffects}
              onChange={() => toggle("coaEffects")}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LayerToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-darla-text-secondary">
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-blue-500" />
      <span>{label}</span>
    </label>
  );
}
