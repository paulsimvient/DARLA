import type { LucideIcon } from "lucide-react";
import {
  Anchor,
  Crosshair,
  Network,
  Package,
  Plane,
  Radar,
  Shield,
  Target,
  Wifi,
} from "lucide-react";
import { sideAccentColor } from "../lib/mapEntityMarkers";

type MarkerKind =
  | "platform-air"
  | "platform-surface"
  | "commander"
  | "network"
  | "cyber"
  | "logistics"
  | "objective"
  | "sensor"
  | "default";

const kindIcons: Record<MarkerKind, LucideIcon> = {
  "platform-air": Plane,
  "platform-surface": Anchor,
  commander: Crosshair,
  network: Network,
  cyber: Shield,
  logistics: Package,
  objective: Target,
  sensor: Radar,
  default: Wifi,
};

type MapEntityMarkerBadgeProps = {
  kind: MarkerKind;
  side: string;
  label?: string;
  selected?: boolean;
  degraded?: boolean;
  destroyed?: boolean;
  size?: "sm" | "md";
};

export default function MapEntityMarkerBadge({
  kind,
  side,
  label,
  selected,
  degraded,
  destroyed,
  size = "md",
}: MapEntityMarkerBadgeProps) {
  const accent = degraded ? "#f59e0b" : sideAccentColor(side);
  const Icon = kindIcons[kind];
  const box = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const iconSize = size === "sm" ? 14 : 16;

  if (kind === "objective" && label) {
    return (
      <div
        className={`rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${
          selected ? "ring-2 ring-white/40" : ""
        } ${destroyed ? "opacity-40" : ""}`}
        style={{
          borderColor: accent,
          color: accent,
          background: `${accent}18`,
        }}
      >
        {label}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border-2 bg-darla-panel shadow-lg transition-all ${
        selected ? "ring-2 ring-darla-blue/40" : ""
      } ${destroyed ? "opacity-40" : ""}`}
      style={{ borderColor: accent }}
    >
      <div className={`flex ${box} items-center justify-center`}>
        <Icon size={iconSize} strokeWidth={1.25} className="text-darla-text" />
      </div>
      <div className="h-0.5 w-full rounded-b-[10px]" style={{ background: accent }} />
    </div>
  );
}

export function mockEntityKind(type: string): MarkerKind {
  switch (type) {
    case "air":
      return "platform-air";
    case "naval":
      return "platform-surface";
    case "cyber":
      return "cyber";
    case "sensor":
      return "sensor";
    case "ground":
      return "commander";
    case "objective":
      return "objective";
    default:
      return "default";
  }
}

export function simEntityKind(kind: string, id: string, alt: number | null): MarkerKind {
  const k = kind.toLowerCase();
  if (k.includes("commander")) return "commander";
  if (k.includes("network")) return "network";
  if (k.includes("cyber")) return "cyber";
  if (k.includes("logistics")) return "logistics";
  if (k.includes("platform")) {
    if (alt != null && alt > 100) return "platform-air";
    if (/uas|uav|air|isr/i.test(id)) return "platform-air";
    return "platform-surface";
  }
  return "default";
}
