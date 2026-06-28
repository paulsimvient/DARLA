import type { SimModule, ModuleCategory } from "../types/moduleCanvas";
import type { DashboardData, MapEntity, RelationshipEdge } from "../types";

function categoryForEntity(entity: MapEntity): ModuleCategory {
  switch (entity.kind) {
    case "Commander":
      return "Command & Control";
    case "Platform":
      return entity.sensor_range_km ? "Sensor System" : "Force Entity";
    case "NetworkNode":
      return "Infrastructure";
    case "CyberService":
      return "Cyber Capability";
    case "LogisticsNode":
      return "Infrastructure";
    default:
      return "Force Entity";
  }
}

function validationForEntity(entity: MapEntity, dashboard: DashboardData | null): SimModule["validationStatus"] {
  if (entity.sensor_isolated || entity.sensor_degraded) return "warn";
  if (dashboard?.async_validation?.completed && !dashboard.async_validation.falsification_survived) {
    return "fail";
  }
  if (entity.sensor_confidence != null && entity.sensor_confidence >= 0.7) return "pass";
  return "warn";
}

function statusForEntity(entity: MapEntity): SimModule["status"] {
  if (entity.sensor_isolated || entity.sensor_degraded) return "draft";
  return "active";
}

function layoutPosition(entity: MapEntity, index: number, entities: MapEntity[]): { x: number; y: number } {
  const positioned = entities.filter((e) => e.has_position && e.lat != null && e.lon != null);
  if (entity.lat == null || entity.lon == null) {
    return { x: 80 + (index % 4) * 140, y: 80 + Math.floor(index / 4) * 100 };
  }
  const lats = positioned.map((e) => e.lat!);
  const lons = positioned.map((e) => e.lon!);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const latSpan = Math.max(maxLat - minLat, 0.01);
  const lonSpan = Math.max(maxLon - minLon, 0.01);
  const x = 60 + ((entity.lon - minLon) / lonSpan) * 720;
  const y = 60 + (1 - (entity.lat - minLat) / latSpan) * 360;
  return { x, y };
}

function inputsForEntity(entity: MapEntity, relationships: RelationshipEdge[]): string[] {
  return relationships
    .filter((edge) => edge.target === entity.id)
    .map((edge) => `${edge.type} ← ${edge.source}`);
}

function outputsForEntity(entity: MapEntity, relationships: RelationshipEdge[]): string[] {
  const outs = relationships
    .filter((edge) => edge.source === entity.id)
    .map((edge) => `${edge.type} → ${edge.target}`);
  if (entity.sensor_range_km) {
    outs.unshift(`Sensor coverage ${entity.sensor_range_km} km`);
  }
  if (entity.alt != null && entity.alt > 0) {
    outs.unshift(`Alt ${entity.alt} m`);
  }
  return outs.length > 0 ? outs : ["State broadcast"];
}

export function buildSimModulesFromEntities(
  entities: MapEntity[],
  relationships: RelationshipEdge[],
  dashboard: DashboardData | null,
): SimModule[] {
  const connectionMap = new Map<string, string[]>();
  for (const edge of relationships) {
    const existing = connectionMap.get(edge.source) ?? [];
    existing.push(edge.target);
    connectionMap.set(edge.source, existing);
  }

  return entities.map((entity, index) => {
    const pos = layoutPosition(entity, index, entities);
    return {
      id: entity.id,
      name: entity.id.replace(/_/g, " "),
      category: categoryForEntity(entity),
      type: entity.kind,
      status: statusForEntity(entity),
      updateRate: `${dashboard?.max_ticks ? 1 : 1} Hz`,
      range: entity.sensor_range_km ? `${entity.sensor_range_km} km` : "Point",
      detectionProbability: entity.sensor_confidence ?? 0,
      latency: entity.sensor_degraded ? "Degraded" : "Nominal",
      confidenceModel:
        entity.sensor_confidence != null
          ? `Live confidence ${entity.sensor_confidence.toFixed(2)}`
          : "Entity state",
      inputs: inputsForEntity(entity, relationships),
      outputs: outputsForEntity(entity, relationships),
      validationStatus: validationForEntity(entity, dashboard),
      x: pos.x,
      y: pos.y,
      connections: connectionMap.get(entity.id) ?? [],
      onCanvas: true,
      description: `${entity.side} ${entity.kind} from scenario export`,
      tags: [entity.side.toLowerCase(), entity.kind.toLowerCase()],
    };
  });
}
