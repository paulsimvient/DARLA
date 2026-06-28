import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type MutableRefObject } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import MapLayerControls, {
  DEFAULT_MAP_LAYER_VISIBILITY,
  type MapLayerVisibility,
} from "./components/MapLayerControls";
import { ensureMapEntityMarkers, entityIconKeyWithState } from "./lib/mapEntityMarkers";
import type { MapEntity, RelationshipEdge, SimMapOverlay } from "./types";

const DEMO_STYLE = "https://demotiles.maplibre.org/style.json";

const SATELLITE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    satellite: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri, Maxar",
    },
    labels: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
    },
  },
  layers: [
    { id: "satellite", type: "raster", source: "satellite" },
    { id: "labels", type: "raster", source: "labels", paint: { "raster-opacity": 0.65 } },
  ],
};

function circlePolygon(lon: number, lat: number, radiusKm: number, points = 64): [number, number][] {
  const coords: [number, number][] = [];
  const earthRadiusKm = 6371;
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  const d = radiusKm / earthRadiusKm;

  for (let i = 0; i <= points; i++) {
    const bearing = (i / points) * 2 * Math.PI;
    const lat2 = Math.asin(
      Math.sin(latRad) * Math.cos(d) + Math.cos(latRad) * Math.sin(d) * Math.cos(bearing),
    );
    const lon2 =
      lonRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(d) * Math.cos(latRad),
        Math.cos(d) - Math.sin(latRad) * Math.sin(lat2),
      );
    coords.push([(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return coords;
}

function buildEntityFeatures(entities: MapEntity[]) {
  return entities
    .filter((e) => e.has_position && e.lat != null && e.lon != null)
    .map((e) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [e.lon!, e.lat!] },
      properties: {
        id: e.id,
        kind: e.kind,
        side: e.side,
        alt: e.alt ?? 0,
        icon_key: entityIconKeyWithState(e),
        sensor_range_km: e.sensor_range_km,
        sensor_confidence: e.sensor_confidence,
        sensor_degraded: e.sensor_degraded,
        sensor_isolated: e.sensor_isolated,
      },
    }));
}

function buildSensorFeatures(entities: MapEntity[]) {
  return entities
    .filter((e) => e.has_position && e.lat != null && e.lon != null && e.sensor_range_km)
    .map((e) => ({
      type: "Feature" as const,
      geometry: {
        type: "Polygon" as const,
        coordinates: [circlePolygon(e.lon!, e.lat!, e.sensor_range_km!)],
      },
      properties: {
        id: e.id,
        side: e.side,
        confidence: e.sensor_confidence ?? 0,
        degraded: e.sensor_degraded,
      },
    }));
}

function buildLinkFeatures(entities: MapEntity[], relationships: RelationshipEdge[]) {
  const byName = new Map(entities.filter((e) => e.has_position).map((e) => [e.id, e]));
  const linkTypes = new Set([
    "senses",
    "communicates_with",
    "depends_on",
    "commands",
    "degrades",
    "supports",
    "supplies",
  ]);

  return relationships
    .filter((edge) => linkTypes.has(edge.type))
    .flatMap((edge) => {
      const source = byName.get(edge.source);
      const target = byName.get(edge.target);
      if (!source?.lon || !source.lat || !target?.lon || !target.lat) return [];
      return [
        {
          type: "Feature" as const,
          geometry: {
            type: "LineString" as const,
            coordinates: [
              [source.lon, source.lat],
              [target.lon, target.lat],
            ],
          },
          properties: {
            type: edge.type,
            component: edge.component,
          },
        },
      ];
    });
}

function fitBounds(map: maplibregl.Map, entities: MapEntity[]) {
  const positioned = entities.filter((e) => e.has_position && e.lat != null && e.lon != null);
  if (positioned.length === 0) return;

  const bounds = new maplibregl.LngLatBounds();
  for (const entity of positioned) {
    bounds.extend([entity.lon!, entity.lat!]);
    if (entity.sensor_range_km) {
      for (const coord of circlePolygon(entity.lon!, entity.lat!, entity.sensor_range_km, 16)) {
        bounds.extend(coord);
      }
    }
  }
  map.fitBounds(bounds, { padding: 56, maxZoom: 9, duration: 0 });
}

function entityById(entities: MapEntity[], id: string) {
  return entities.find((e) => e.id === id);
}

function entityHasPosition(entity: MapEntity | undefined): entity is MapEntity & { lon: number; lat: number } {
  return entity?.has_position === true && entity.lon != null && entity.lat != null;
}

function buildEntityPopupHtml(entity: MapEntity) {
  return `<div style="font-family:Inter,sans-serif;font-size:12px;line-height:1.4">
    <strong>${entity.id}</strong><br/>
    ${entity.kind} · ${entity.side}<br/>
    alt ${entity.alt ?? 0} m${
      entity.sensor_range_km
        ? `<br/>sensor ${entity.sensor_range_km} km · conf ${(entity.sensor_confidence ?? 0).toFixed(2)}`
        : ""
    }<br/><br/>
    <button type="button" data-darla-causal-trigger="true" style="
      width:100%;padding:6px 8px;border-radius:8px;border:1px solid #38bdf8;
      background:#0c4a6e;color:#fff;cursor:pointer;font-size:12px;">
      View causal chain →
    </button>
  </div>`;
}

function wireCausalPopupButton(
  popup: maplibregl.Popup,
  entityId: string,
  onOpenCausalDrilldown?: (entityId: string) => void,
) {
  const button = popup
    .getElement()
    ?.querySelector<HTMLButtonElement>("[data-darla-causal-trigger]");
  if (!button || button.dataset.wired === "true") return;
  button.dataset.wired = "true";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onOpenCausalDrilldown?.(entityId);
    popup.remove();
  });
}

function openEntityPopup(
  map: maplibregl.Map,
  entity: MapEntity,
  onOpenCausalDrilldown?: (entityId: string) => void,
) {
  if (entity.lon == null || entity.lat == null) return null;

  const popup = new maplibregl.Popup({
    closeButton: true,
    className: "darla-map-popup",
    maxWidth: "240px",
    offset: 12,
  })
    .setLngLat([entity.lon, entity.lat])
    .setHTML(buildEntityPopupHtml(entity));

  popup.on("open", () => wireCausalPopupButton(popup, entity.id, onOpenCausalDrilldown));
  popup.addTo(map);
  wireCausalPopupButton(popup, entity.id, onOpenCausalDrilldown);

  return popup;
}

function upsertSelectionHighlight(map: maplibregl.Map, entity: MapEntity | null) {
  const sourceId = "selection-highlight";
  const features =
    entity?.lon != null && entity.lat != null
      ? [
          {
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [entity.lon, entity.lat] },
            properties: { id: entity.id },
          },
        ]
      : [];

  const collection: GeoJSON.FeatureCollection = { type: "FeatureCollection", features };
  const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
  if (source) {
    source.setData(collection);
    return;
  }
  if (features.length === 0) return;

  map.addSource(sourceId, { type: "geojson", data: collection });
  map.addLayer({
    id: "selection-highlight-ring",
    type: "circle",
    source: sourceId,
    paint: {
      "circle-radius": 22,
      "circle-color": "#3b82f6",
      "circle-opacity": 0.12,
      "circle-stroke-color": "#3b82f6",
      "circle-stroke-width": 2,
    },
  });
}

function focusEdgeOnMap(
  map: maplibregl.Map,
  entities: MapEntity[],
  sourceId: string,
  targetId: string,
) {
  const source = entityById(entities, sourceId);
  const target = entityById(entities, targetId);
  if (!entityHasPosition(source) || !entityHasPosition(target)) return;

  const bounds = new maplibregl.LngLatBounds();
  bounds.extend([source.lon, source.lat]);
  bounds.extend([target.lon, target.lat]);
  map.fitBounds(bounds, { padding: 80, maxZoom: 10, duration: 600 });
}

function focusEntitiesOnMap(map: maplibregl.Map, entities: MapEntity[], entityIds: string[]) {
  const positioned = entityIds
    .map((id) => entityById(entities, id))
    .filter((entity): entity is MapEntity & { lon: number; lat: number } => entityHasPosition(entity));
  if (positioned.length === 0) return;

  if (positioned.length === 1) {
    const [entity] = positioned;
    map.flyTo({ center: [entity.lon, entity.lat], zoom: 9, duration: 600 });
    return;
  }

  const bounds = new maplibregl.LngLatBounds();
  for (const entity of positioned) {
    bounds.extend([entity.lon, entity.lat]);
  }
  map.fitBounds(bounds, { padding: 80, maxZoom: 10, duration: 600 });
}

function focusEntityOnMap(
  map: maplibregl.Map,
  entity: MapEntity & { lon: number; lat: number },
  onOpenCausalDrilldown: ((entityId: string) => void) | undefined,
  popupRef: MutableRefObject<maplibregl.Popup | null>,
) {
  map.flyTo({ center: [entity.lon, entity.lat], zoom: 9, duration: 600 });
  upsertSelectionHighlight(map, entity);
  popupRef.current?.remove();
  popupRef.current = openEntityPopup(map, entity, onOpenCausalDrilldown) ?? null;
}

function buildMapFocusSignature(
  focusStamp: number,
  selectedEntityId: string | null | undefined,
  focusEdge: { source: string; target: string } | null | undefined,
  fitEntityIds: string[] | null | undefined,
): string {
  const edge = focusEdge ? `${focusEdge.source}|${focusEdge.target}` : "";
  const fit = fitEntityIds?.length ? fitEntityIds.join(",") : "";
  return `${focusStamp}:${selectedEntityId ?? ""}:${edge}:${fit}`;
}

type MapViewMode = "operational" | "3d";

type MapPanelProps = {
  entities: MapEntity[];
  relationships: RelationshipEdge[];
  currentTick?: number;
  liveTick?: number;
  timelineMode?: "follow" | "inspect";
  selectedEntityId?: string | null;
  focusEdge?: { source: string; target: string } | null;
  fitEntityIds?: string[] | null;
  focusStamp?: number;
  coaOverlay?: { id: number; action: string; target: string } | null;
  simOverlays?: SimMapOverlay[];
  viewMode?: MapViewMode;
  onViewModeChange?: (mode: MapViewMode) => void;
  onSelectEntity?: (entityId: string | null) => void;
  onOpenCausalDrilldown?: (entityId: string) => void;
  className?: string;
  showChrome?: boolean;
};

function applyLayerVisibility(map: maplibregl.Map, visibility: MapLayerVisibility) {
  const setVis = (layerId: string, visible: boolean) => {
    if (!map.getLayer(layerId)) return;
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  };

  setVis("entities-marker", visibility.units);
  setVis("entities-label", visibility.units);
  setVis("selection-highlight-ring", visibility.units);
  setVis("links-line", visibility.routes);
  setVis("sensor-range-fill", visibility.riskZones);
  setVis("sensor-range-outline", visibility.riskZones);
  setVis("sim-overlay-risk-fill", visibility.riskZones);
  setVis("sim-overlay-risk-outline", visibility.riskZones);
  setVis("sim-overlay-coa-fill", visibility.coaEffects);
  setVis("sim-overlay-coa-outline", visibility.coaEffects);
}

export type MapPanelHandle = {
  focusCurrentSelection: () => void;
};

function applyMapCameraFocus(
  map: maplibregl.Map,
  entities: MapEntity[],
  selectedEntityId: string | null | undefined,
  focusEdge: { source: string; target: string } | null | undefined,
  fitEntityIds: string[] | null | undefined,
): boolean {
  if (focusEdge) {
    focusEdgeOnMap(map, entities, focusEdge.source, focusEdge.target);
    return true;
  }
  if (selectedEntityId) {
    const entity = entityById(entities, selectedEntityId);
    if (entityHasPosition(entity)) {
      map.flyTo({ center: [entity.lon, entity.lat], zoom: 9, duration: 600 });
      return true;
    }
  }
  if (fitEntityIds && fitEntityIds.length > 0) {
    focusEntitiesOnMap(map, entities, fitEntityIds);
    return true;
  }
  return false;
}

const MapPanel = forwardRef<MapPanelHandle, MapPanelProps>(function MapPanel({
  entities,
  relationships,
  currentTick,
  liveTick,
  timelineMode = "follow",
  selectedEntityId,
  focusEdge,
  fitEntityIds,
  focusStamp = 0,
  coaOverlay,
  simOverlays = [],
  viewMode: viewModeProp,
  onViewModeChange,
  onSelectEntity,
  onOpenCausalDrilldown,
  className = "",
  showChrome = true,
}: MapPanelProps, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const focusStateRef = useRef({
    entities,
    selectedEntityId,
    focusEdge,
    fitEntityIds,
    focusStamp,
    onOpenCausalDrilldown,
  });
  focusStateRef.current = {
    entities,
    selectedEntityId,
    focusEdge,
    fitEntityIds,
    focusStamp,
    onOpenCausalDrilldown,
  };

  const lastCameraFocusRef = useRef("");
  const lastPopupFocusRef = useRef("");
  const lastFocusStampRef = useRef(-1);
  const pendingCameraFocusRef = useRef<string | null>(null);

  const runCameraFocus = (force = false) => {
    const map = mapRef.current;
    const state = focusStateRef.current;
    const signature = buildMapFocusSignature(
      state.focusStamp,
      state.selectedEntityId,
      state.focusEdge,
      state.fitEntityIds,
    );
    if (!map || !map.isStyleLoaded()) {
      pendingCameraFocusRef.current = signature;
      return false;
    }

    const focusRequest = state.focusStamp !== lastFocusStampRef.current;
    const pendingRetry = pendingCameraFocusRef.current === signature;
    if (!force && !focusRequest && !pendingRetry && signature === lastCameraFocusRef.current) {
      return false;
    }

    if (focusRequest || force) {
      lastFocusStampRef.current = state.focusStamp;
      lastCameraFocusRef.current = "";
    }

    const applied = applyMapCameraFocus(
      map,
      state.entities,
      state.selectedEntityId,
      state.focusEdge,
      state.fitEntityIds,
    );

    if (applied) {
      lastCameraFocusRef.current = signature;
      pendingCameraFocusRef.current = null;
    } else {
      pendingCameraFocusRef.current = signature;
    }

    if (applied && state.selectedEntityId && !state.focusEdge) {
      const entity = entityById(state.entities, state.selectedEntityId);
      if (entityHasPosition(entity)) {
        upsertSelectionHighlight(map, entity);
        if (signature !== lastPopupFocusRef.current) {
          lastPopupFocusRef.current = signature;
          popupRef.current?.remove();
          popupRef.current = openEntityPopup(map, entity, state.onOpenCausalDrilldown) ?? null;
        }
      }
    }

    return applied;
  };
  const runCameraFocusRef = useRef(runCameraFocus);
  runCameraFocusRef.current = runCameraFocus;

  useImperativeHandle(ref, () => ({
    focusCurrentSelection: () => {
      runCameraFocusRef.current(true);
    },
  }));
  const fittedRef = useRef(false);
  const layersReadyRef = useRef(false);
  const handlersReadyRef = useRef(false);
  const entityInteractionRef = useRef<(entityId: string) => void>(() => {});
  entityInteractionRef.current = (entityId: string) => {
    onSelectEntity?.(entityId);
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const entity = entityById(entities, entityId);
    if (!entityHasPosition(entity)) return;
    focusEntityOnMap(map, entity, onOpenCausalDrilldown, popupRef);
  };
  const viewRef = useRef({
    entities,
    relationships,
    simOverlays,
    onSelectEntity,
    onOpenCausalDrilldown,
  });
  viewRef.current = { entities, relationships, simOverlays, onSelectEntity, onOpenCausalDrilldown };
  const [internalViewMode, setInternalViewMode] = useState<MapViewMode>("operational");
  const viewMode = viewModeProp ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [styleEpoch, setStyleEpoch] = useState(0);
  const [layerVisibility, setLayerVisibility] = useState<MapLayerVisibility>(
    DEFAULT_MAP_LAYER_VISIBILITY,
  );
  const hadEntitiesRef = useRef(false);
  const focusSignature = buildMapFocusSignature(
    focusStamp,
    selectedEntityId,
    focusEdge,
    fitEntityIds,
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container,
        style: SATELLITE_STYLE,
        center: [122.0, 25.0],
        zoom: 7,
        attributionControl: false,
      });
    } catch (err) {
      setMapError(err instanceof Error ? err.message : "Map failed to initialize");
      return;
    }

    mapRef.current = map;
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 80, unit: "metric" }), "bottom-right");

    map.on("error", (event) => {
      if (!mapRef.current) return;
      const message = event.error?.message ?? "Map tile error";
      if (message.includes("sprite") || message.includes("glyph") || message.includes("source")) {
        if (map.getStyle()?.name !== "demo-fallback") {
          map.setStyle(DEMO_STYLE);
        }
        return;
      }
      setMapError(message);
    });

    const syncLayers = (fit: boolean) => {
      if (!map.isStyleLoaded()) return;
      updateMapLayers(
        map,
        viewRef.current.entities,
        viewRef.current.relationships,
        viewRef.current.simOverlays,
        fit,
        entityInteractionRef,
        layersReadyRef,
        handlersReadyRef,
      );
      map.resize();
    };

    const onStyleReady = (fit: boolean) => {
      setMapReady(true);
      setStyleEpoch((epoch) => epoch + 1);
      syncLayers(fit);
      fittedRef.current = true;
      requestAnimationFrame(() => runCameraFocusRef.current(true));
    };

    map.on("load", () => {
      onStyleReady(!fittedRef.current);
    });

    map.on("style.load", () => {
      layersReadyRef.current = false;
      onStyleReady(!fittedRef.current);
    });

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      fittedRef.current = false;
      layersReadyRef.current = false;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!map.isStyleLoaded()) {
      const onLoad = () => {
        updateMapLayers(
          map,
          entities,
          relationships,
          simOverlays,
          false,
          entityInteractionRef,
          layersReadyRef,
          handlersReadyRef,
          layerVisibility,
        );
      };
      map.once("load", onLoad);
      return () => {
        map.off("load", onLoad);
      };
    }

    updateMapLayers(
      map,
      entities,
      relationships,
      simOverlays,
      false,
      entityInteractionRef,
      layersReadyRef,
      handlersReadyRef,
      layerVisibility,
    );
  }, [entities, relationships, simOverlays, layerVisibility, onSelectEntity, onOpenCausalDrilldown]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const is3d = viewMode === "3d";
    map.easeTo({
      pitch: is3d ? 58 : 0,
      bearing: is3d ? -25 : 0,
      duration: 700,
    });
    if (map.getLayer("entities-label")) {
      map.setLayoutProperty(
        "entities-label",
        "text-field",
        is3d
          ? ["concat", ["get", "id"], " · ", ["to-string", ["get", "alt"]], "m"]
          : ["get", "id"],
      );
    }
  }, [viewMode]);

  useEffect(() => {
    if (entities.length > 0 && !hadEntitiesRef.current) {
      hadEntitiesRef.current = true;
      lastCameraFocusRef.current = "";
    }
    if (entities.length === 0) {
      hadEntitiesRef.current = false;
    }
  }, [entities.length]);

  useEffect(() => {
    lastCameraFocusRef.current = "";
    lastPopupFocusRef.current = "";
  }, [styleEpoch]);

  useEffect(() => {
    runCameraFocusRef.current();
  }, [focusStamp, focusSignature, styleEpoch, entities, selectedEntityId, focusEdge, fitEntityIds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.isStyleLoaded()) return;

    if (focusEdge) {
      const source = entityById(entities, focusEdge.source);
      const target = entityById(entities, focusEdge.target);
      const highlight = entityHasPosition(source) ? source : entityHasPosition(target) ? target : null;
      upsertSelectionHighlight(map, highlight);
      popupRef.current?.remove();
      if (highlight && focusSignature !== lastPopupFocusRef.current) {
        lastPopupFocusRef.current = focusSignature;
        popupRef.current = openEntityPopup(map, highlight, onOpenCausalDrilldown) ?? null;
      } else {
        lastPopupFocusRef.current = focusSignature;
        popupRef.current = null;
      }
      return;
    }

    if (fitEntityIds && fitEntityIds.length > 0 && !selectedEntityId) {
      upsertSelectionHighlight(map, null);
      popupRef.current?.remove();
      popupRef.current = null;
      lastPopupFocusRef.current = focusSignature;
      return;
    }

    if (!selectedEntityId) {
      upsertSelectionHighlight(map, null);
      popupRef.current?.remove();
      popupRef.current = null;
      lastPopupFocusRef.current = "";
      return;
    }

    const entity = entityById(entities, selectedEntityId);
    if (!entityHasPosition(entity)) return;

    upsertSelectionHighlight(map, entity);
    if (focusSignature !== lastPopupFocusRef.current) {
      lastPopupFocusRef.current = focusSignature;
      popupRef.current?.remove();
      popupRef.current = openEntityPopup(map, entity, onOpenCausalDrilldown) ?? null;
    }
  }, [focusSignature, selectedEntityId, focusEdge, fitEntityIds, entities, onOpenCausalDrilldown, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.isStyleLoaded()) return;
    applyLayerVisibility(map, layerVisibility);
  }, [layerVisibility, mapReady]);

  useEffect(() => {
    return () => {
      popupRef.current?.remove();
    };
  }, []);

  return (
    <div
      className={`relative h-full min-h-[360px] w-full overflow-hidden rounded-xl border border-darla-border bg-[#050508] ${className}`}
    >
      <div ref={containerRef} className="h-full w-full" />

      {mapError ? (
        <div className="pointer-events-none absolute inset-x-0 top-14 z-10 px-4">
          <div className="rounded-md border border-red-500/40 bg-red-950/80 px-3 py-2 text-xs text-red-200">
            Map error: {mapError}
          </div>
        </div>
      ) : null}

      {coaOverlay ? (
        <div className="pointer-events-none absolute right-3 top-3 z-10 max-w-[220px] rounded-full border border-emerald-500/40 bg-emerald-950/80 px-3 py-1.5 text-[11px] text-emerald-100 backdrop-blur-sm">
          COA overlay: {coaOverlay.action.replace(/_/g, " ")} → {coaOverlay.target}
        </div>
      ) : null}

      {showChrome ? (
        <>
          <MapLayerControls visibility={layerVisibility} onChange={setLayerVisibility} />
          <div className="pointer-events-auto absolute right-3 top-3 z-10">
            <select
              className="darla-select bg-darla-panel/90 py-1.5 text-[11px] backdrop-blur-sm"
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as MapViewMode)}
            >
              <option value="operational">Operational View</option>
              <option value="3d">High-Fidelity View (3D)</option>
            </select>
          </div>
          {viewMode === "3d" ? (
            <div className="pointer-events-none absolute right-3 top-24 z-10 rounded-md border border-sky-500/30 bg-sky-950/70 px-2 py-1 text-[10px] text-sky-100 backdrop-blur-sm">
              3D perspective · altitudes from sim kinematics
            </div>
          ) : null}
          {currentTick != null ? (
            <div className="pointer-events-none absolute bottom-12 left-3 z-10 flex flex-col gap-1">
              <div className="rounded-md border border-darla-border/80 bg-darla-panel/90 px-2.5 py-1 font-mono text-[10px] text-darla-text backdrop-blur-sm">
                Viewing T+{currentTick}
                {liveTick != null && timelineMode === "inspect" && liveTick !== currentTick ? (
                  <span className="text-darla-text-muted"> · live T+{liveTick}</span>
                ) : null}
              </div>
              {timelineMode === "inspect" ? (
                <div className="rounded-md border border-blue-500/30 bg-blue-950/70 px-2 py-0.5 text-[9px] text-blue-200 backdrop-blur-sm">
                  Inspecting simulated state at this tick
                </div>
              ) : (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-950/70 px-2 py-0.5 text-[9px] text-emerald-200 backdrop-blur-sm">
                  Following live simulation
                </div>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
});

export default MapPanel;

function buildSimOverlayFeatures(overlays: SimMapOverlay[]) {
  return overlays.map((overlay) => ({
    type: "Feature" as const,
    geometry: overlay.geometry,
    properties: {
      id: overlay.id,
      style: overlay.style,
      label: overlay.label,
      confidence: overlay.confidence ?? 0,
      source: overlay.source,
      coa_id: overlay.coa_id ?? 0,
      entity_id: overlay.entity_id ?? "",
    },
  }));
}

function updateMapLayers(
  map: maplibregl.Map,
  entities: MapEntity[],
  relationships: RelationshipEdge[],
  simOverlays: SimMapOverlay[],
  fit: boolean,
  entityInteractionRef: MutableRefObject<(entityId: string) => void>,
  layersReadyRef: MutableRefObject<boolean>,
  handlersReadyRef: MutableRefObject<boolean>,
  layerVisibility: MapLayerVisibility = DEFAULT_MAP_LAYER_VISIBILITY,
) {
  const entityFeatures = buildEntityFeatures(entities);
  const sensorFeatures = buildSensorFeatures(entities);
  const linkFeatures = buildLinkFeatures(entities, relationships);

  const upsert = (id: string, featureCollection: GeoJSON.FeatureCollection) => {
    const source = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(featureCollection);
    } else {
      map.addSource(id, { type: "geojson", data: featureCollection });
    }
  };

  upsert("entities", { type: "FeatureCollection", features: entityFeatures });
  upsert("sensor-ranges", { type: "FeatureCollection", features: sensorFeatures });
  upsert("links", { type: "FeatureCollection", features: linkFeatures });
  upsert("sim-overlays", { type: "FeatureCollection", features: buildSimOverlayFeatures(simOverlays) });

  const installLayers = () => {
    if (layersReadyRef.current) {
      if (fit) fitBounds(map, entities);
      return;
    }

    if (!map.getLayer("sim-overlay-risk-fill")) {
      map.addLayer({
        id: "sim-overlay-risk-fill",
        type: "fill",
        source: "sim-overlays",
        filter: ["match", ["get", "style"], ["risk_zone", "sensor_range"], true, false],
        paint: {
          "fill-color": "#ef4444",
          "fill-opacity": 0.18,
        },
      });
    }
    if (!map.getLayer("sim-overlay-risk-outline")) {
      map.addLayer({
        id: "sim-overlay-risk-outline",
        type: "line",
        source: "sim-overlays",
        filter: ["match", ["get", "style"], ["risk_zone", "sensor_range"], true, false],
        paint: {
          "line-color": "#ef4444",
          "line-opacity": 0.85,
          "line-width": 2,
          "line-dasharray": [3, 2],
        },
      });
    }
    if (!map.getLayer("sim-overlay-coa-fill")) {
      map.addLayer({
        id: "sim-overlay-coa-fill",
        type: "fill",
        source: "sim-overlays",
        filter: ["match", ["get", "style"], ["intervention", "effect_area"], true, false],
        paint: {
          "fill-color": [
            "match",
            ["get", "style"],
            "intervention",
            "#10b981",
            "effect_area",
            "#f59e0b",
            "#6366f1",
          ],
          "fill-opacity": 0.18,
        },
      });
    }
    if (!map.getLayer("sim-overlay-coa-outline")) {
      map.addLayer({
        id: "sim-overlay-coa-outline",
        type: "line",
        source: "sim-overlays",
        filter: ["match", ["get", "style"], ["intervention", "effect_area"], true, false],
        paint: {
          "line-color": [
            "match",
            ["get", "style"],
            "intervention",
            "#10b981",
            "effect_area",
            "#f59e0b",
            "#6366f1",
          ],
          "line-opacity": 0.85,
          "line-width": 2,
          "line-dasharray": [3, 2],
        },
      });
    }
    if (!map.getLayer("sensor-range-fill")) {
      map.addLayer({
        id: "sensor-range-fill",
        type: "fill",
        source: "sensor-ranges",
        paint: {
          "fill-color": ["case", ["get", "degraded"], "#fbbf24", "#3b82f6"],
          "fill-opacity": 0.12,
        },
      });
    }
    if (!map.getLayer("sensor-range-outline")) {
      map.addLayer({
        id: "sensor-range-outline",
        type: "line",
        source: "sensor-ranges",
        paint: {
          "line-color": ["case", ["get", "degraded"], "#fbbf24", "#3b82f6"],
          "line-opacity": 0.55,
          "line-width": 1.5,
          "line-dasharray": [4, 3],
        },
      });
    }
    if (!map.getLayer("links-line")) {
      map.addLayer({
        id: "links-line",
        type: "line",
        source: "links",
        paint: {
          "line-color": "#93c5fd",
          "line-opacity": 0.7,
          "line-width": 1.5,
          "line-dasharray": [2, 2],
        },
      });
    }
    if (!map.getLayer("entities-marker")) {
      map.addLayer({
        id: "entities-marker",
        type: "symbol",
        source: "entities",
        layout: {
          "icon-image": ["get", "icon_key"],
          "icon-size": 1,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
    }
    if (!map.getLayer("entities-label")) {
      map.addLayer({
        id: "entities-label",
        type: "symbol",
        source: "entities",
        layout: {
          "text-field": ["get", "id"],
          "text-size": 10,
          "text-offset": [0, 1.8],
          "text-anchor": "top",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#fafafa",
          "text-halo-color": "rgba(0,0,0,0.85)",
          "text-halo-width": 1.5,
        },
      });
    }

    if (!handlersReadyRef.current) {
      map.on("click", "entities-marker", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const props = feature.properties;
        if (!props) return;
        const entityId = props.id as string;
        entityInteractionRef.current(entityId);
      });
      map.on("mouseenter", "entities-marker", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "entities-marker", () => {
        map.getCanvas().style.cursor = "";
      });
      handlersReadyRef.current = true;
    }

    layersReadyRef.current = true;
    applyLayerVisibility(map, layerVisibility);
    if (fit) fitBounds(map, entities);
  };

  void ensureMapEntityMarkers(map)
    .then(installLayers)
    .catch((err) => {
      console.error("Failed to load map entity markers", err);
      installLayers();
    });
}
