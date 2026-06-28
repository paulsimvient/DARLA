import type { Map as MaplibreMap } from "maplibre-gl";
import type { MapEntity } from "../types";

export type EntityKindKey =
  | "platform-air"
  | "platform-surface"
  | "commander"
  | "network"
  | "cyber"
  | "logistics"
  | "default";

export type EntitySideKey = "blue" | "red" | "neutral";

const SIDE_COLORS: Record<EntitySideKey, string> = {
  blue: "#3b82f6",
  red: "#ef4444",
  neutral: "#a1a1aa",
};

const PANEL_FILL = "#15161d";
const ICON_STROKE = "#f4f4f5";

function normalizeSide(side: string): EntitySideKey {
  const s = side.toLowerCase();
  if (s === "blue") return "blue";
  if (s === "red") return "red";
  return "neutral";
}

function normalizeKind(kind: string): EntityKindKey {
  const k = kind.toLowerCase();
  if (k.includes("commander")) return "commander";
  if (k.includes("network")) return "network";
  if (k.includes("cyber")) return "cyber";
  if (k.includes("logistics")) return "logistics";
  if (k.includes("platform")) return "platform-surface";
  return "default";
}

export function platformVariant(entity: Pick<MapEntity, "id" | "alt">): "air" | "surface" {
  if (entity.alt != null && entity.alt > 100) return "air";
  if (/uas|uav|air|isr/i.test(entity.id)) return "air";
  if (/maritime|ship|surface|target|vessel/i.test(entity.id)) return "surface";
  return entity.alt != null && entity.alt > 0 ? "air" : "surface";
}

export function entityKindKey(entity: Pick<MapEntity, "kind" | "id" | "alt">): EntityKindKey {
  const base = normalizeKind(entity.kind);
  if (base === "platform-surface" || entity.kind.toLowerCase().includes("platform")) {
    return platformVariant(entity) === "air" ? "platform-air" : "platform-surface";
  }
  return base;
}

export function entityIconKey(entity: MapEntity): string {
  const side = normalizeSide(entity.side);
  const kind = entityKindKey(entity);
  return `entity-${side}-${kind}`;
}

export function sideAccentColor(side: string): string {
  return SIDE_COLORS[normalizeSide(side)];
}

function glyphPaths(kind: EntityKindKey): string {
  switch (kind) {
    case "platform-air":
      return `
        <path d="M20 9 L27 19 H23 L25 30 L20 26 L15 30 L17 19 H13 Z" fill="${ICON_STROKE}" stroke="none"/>
      `;
    case "platform-surface":
      return `
        <path d="M10 24 L30 24 L26 19 L20 15 L14 19 Z" fill="${ICON_STROKE}" stroke="none"/>
        <path d="M20 15 V11" stroke="${ICON_STROKE}" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M8 24 H32" stroke="${ICON_STROKE}" stroke-width="1.4" stroke-linecap="round" opacity="0.55"/>
      `;
    case "commander":
      return `
        <circle cx="20" cy="20" r="4.5" fill="none" stroke="${ICON_STROKE}" stroke-width="1.6"/>
        <path d="M20 10 V13 M20 27 V30 M10 20 H13 M27 20 H30 M13.5 13.5 L15.7 15.7 M24.3 24.3 L26.5 26.5 M26.5 13.5 L24.3 15.7 M15.7 24.3 L13.5 26.5" stroke="${ICON_STROKE}" stroke-width="1.5" stroke-linecap="round"/>
      `;
    case "network":
      return `
        <circle cx="13" cy="21" r="3" fill="${ICON_STROKE}"/>
        <circle cx="27" cy="14" r="3" fill="${ICON_STROKE}"/>
        <circle cx="27" cy="28" r="3" fill="${ICON_STROKE}"/>
        <path d="M15.5 20 L24.5 15 M15.5 22 L24.5 27" stroke="${ICON_STROKE}" stroke-width="1.4" stroke-linecap="round"/>
      `;
    case "cyber":
      return `
        <path d="M20 10 L30 15 V23 Q20 31 10 23 V15 Z" fill="none" stroke="${ICON_STROKE}" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M20 17 V22 M17.5 19.5 H22.5" stroke="${ICON_STROKE}" stroke-width="1.5" stroke-linecap="round"/>
      `;
    case "logistics":
      return `
        <path d="M11 16 H29 V28 H11 Z" fill="none" stroke="${ICON_STROKE}" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M11 16 L20 12 L29 16" fill="none" stroke="${ICON_STROKE}" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M20 12 V28" stroke="${ICON_STROKE}" stroke-width="1.2" opacity="0.45"/>
      `;
    default:
      return `
        <circle cx="20" cy="20" r="8" fill="none" stroke="${ICON_STROKE}" stroke-width="1.6"/>
        <path d="M20 12 V28 M12 20 H28" stroke="${ICON_STROKE}" stroke-width="1.4" stroke-linecap="round"/>
      `;
  }
}

export function buildMarkerSvg(kind: EntityKindKey, side: EntitySideKey, degraded = false): string {
  const accent = degraded ? "#f59e0b" : SIDE_COLORS[side];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <defs>
      <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="#000" flood-opacity="0.45"/>
      </filter>
    </defs>
    <rect x="3" y="3" width="34" height="34" rx="9" fill="${PANEL_FILL}" stroke="${accent}" stroke-width="2.2" filter="url(#s)"/>
    <g transform="translate(0,0)">${glyphPaths(kind)}</g>
  </svg>`;
}

const ALL_KINDS: EntityKindKey[] = [
  "platform-air",
  "platform-surface",
  "commander",
  "network",
  "cyber",
  "logistics",
  "default",
];

const ALL_SIDES: EntitySideKey[] = ["blue", "red", "neutral"];

function svgToImage(svg: string, size = 40): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(size, size);
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load map marker image"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

export async function ensureMapEntityMarkers(map: MaplibreMap): Promise<void> {
  const loads: Promise<void>[] = [];

  for (const side of ALL_SIDES) {
    for (const kind of ALL_KINDS) {
      const id = `entity-${side}-${kind}`;
      if (map.hasImage(id)) continue;

      loads.push(
        svgToImage(buildMarkerSvg(kind, side)).then((image) => {
          if (!map.hasImage(id)) {
            map.addImage(id, image, { pixelRatio: 2 });
          }
        }),
      );

      const degradedId = `${id}-degraded`;
      if (!map.hasImage(degradedId)) {
        loads.push(
          svgToImage(buildMarkerSvg(kind, side, true)).then((image) => {
            if (!map.hasImage(degradedId)) {
              map.addImage(degradedId, image, { pixelRatio: 2 });
            }
          }),
        );
      }
    }
  }

  await Promise.all(loads);
}

export function entityIconKeyWithState(entity: MapEntity): string {
  const base = entityIconKey(entity);
  if (entity.sensor_degraded) return `${base}-degraded`;
  return base;
}

export function entityKindLabel(entity: Pick<MapEntity, "kind" | "id" | "alt">): string {
  const kind = entityKindKey(entity);
  switch (kind) {
    case "platform-air":
      return "Air platform";
    case "platform-surface":
      return "Surface platform";
    case "commander":
      return "Commander";
    case "network":
      return "Network node";
    case "cyber":
      return "Cyber service";
    case "logistics":
      return "Logistics";
    default:
      return entity.kind;
  }
}
