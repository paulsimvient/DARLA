import type { CourseOfAction, MapEntity, RelationshipEdge, SimEvent } from "../types";
import { eventsInRange, type TickRange } from "../utils/timelineGroupSelection";
import { buildEffectiveCoaLog } from "../utils/effectiveCoaLog";
import type { PlaybackFrame } from "../playback";

export type TreeSelection =
  | { type: "scenario" }
  | { type: "environment" }
  | { type: "mission" }
  | { type: "force"; side: string }
  | { type: "entity"; id: string }
  | { type: "relationships" }
  | { type: "relationship"; index: number }
  | { type: "events" }
  | { type: "event"; id: number }
  | { type: "coas" }
  | { type: "coa"; id: number };

export type MapFocus = {
  selectedEntityId: string | null;
  focusEdge: { source: string; target: string } | null;
  fitEntityIds: string[] | null;
};

function entityByName(entities: MapEntity[], id: string): MapEntity | undefined {
  return entities.find((entity) => entity.id === id);
}

function entityHasMapPosition(entity: MapEntity | undefined): entity is MapEntity & {
  lat: number;
  lon: number;
} {
  return entity?.has_position === true && entity.lat != null && entity.lon != null;
}

function positionedEntityIds(entities: MapEntity[]): string[] {
  return entities.filter((entity) => entityHasMapPosition(entity)).map((entity) => entity.id);
}

function tokenToEntityId(token: string, entities: MapEntity[]): string | null {
  if (entityByName(entities, token)) return token;
  const prefix = token.split(".")[0];
  if (prefix && entityByName(entities, prefix)) return prefix;
  return null;
}

function neighborsWithPosition(
  entityId: string,
  entities: MapEntity[],
  relationships: RelationshipEdge[],
): string[] {
  const ids = new Set<string>();
  for (const edge of relationships) {
    if (edge.source === entityId) {
      const target = entityByName(entities, edge.target);
      if (entityHasMapPosition(target)) ids.add(edge.target);
    }
    if (edge.target === entityId) {
      const source = entityByName(entities, edge.source);
      if (entityHasMapPosition(source)) ids.add(edge.source);
    }
  }
  return [...ids];
}

function resolveEventEntityIds(event: SimEvent | undefined, entities: MapEntity[]): string[] {
  if (!event) return [];

  const ids = new Set<string>();
  const actor = entities.find((entity) => entity.entity_id === event.actor);
  if (entityHasMapPosition(actor)) ids.add(actor.id);

  for (const delta of event.deltas) {
    for (const token of [delta.before, delta.after]) {
      const id = tokenToEntityId(token, entities);
      if (id) ids.add(id);
    }
    const fieldRoot = delta.field.split(".")[0];
    const fieldId = tokenToEntityId(fieldRoot, entities);
    if (fieldId) ids.add(fieldId);
  }

  return positionedEntityIds(entities).filter((id) => ids.has(id));
}

function findCoa(
  id: number,
  coaLog: CourseOfAction[],
  frameCoas: CourseOfAction[] = [],
): CourseOfAction | undefined {
  return coaLog.find((coa) => coa.id === id) ?? frameCoas.find((coa) => coa.id === id);
}

function coaTargetIds(coaLog: CourseOfAction[], frameCoas: CourseOfAction[], entities: MapEntity[]): string[] {
  const ids = new Set<string>();
  for (const coa of [...coaLog, ...frameCoas]) {
    if (!coa.target) continue;
    const target = entityByName(entities, coa.target);
    if (entityHasMapPosition(target)) ids.add(coa.target);
  }
  return [...ids];
}

function relationshipEndpointIds(relationships: RelationshipEdge[], entities: MapEntity[]): string[] {
  const ids = new Set<string>();
  for (const edge of relationships) {
    const source = entityByName(entities, edge.source);
    const target = entityByName(entities, edge.target);
    if (entityHasMapPosition(source)) ids.add(edge.source);
    if (entityHasMapPosition(target)) ids.add(edge.target);
  }
  return [...ids];
}

function missionEntityIds(entities: MapEntity[]): string[] {
  const ids = entities
    .filter(
      (entity) =>
        entityHasMapPosition(entity) &&
        (entity.kind === "Platform" ||
          entity.kind === "Commander" ||
          entity.id.includes("target") ||
          entity.side === "Red"),
    )
    .map((entity) => entity.id);
  return ids.length > 0 ? ids : positionedEntityIds(entities);
}

function focusSingleOrFit(ids: string[]): MapFocus {
  if (ids.length === 1) {
    return { selectedEntityId: ids[0], focusEdge: null, fitEntityIds: null };
  }
  return { selectedEntityId: null, focusEdge: null, fitEntityIds: ids.length > 0 ? ids : null };
}

export function mapFocusFromSelection(
  selection: TreeSelection,
  relationships: RelationshipEdge[],
  entities: MapEntity[] = [],
  events: SimEvent[] = [],
  coaLog: CourseOfAction[] = [],
  frameCoas: CourseOfAction[] = [],
): MapFocus {
  if (selection.type === "entity") {
    const entity = entityByName(entities, selection.id);
    if (entityHasMapPosition(entity)) {
      return { selectedEntityId: selection.id, focusEdge: null, fitEntityIds: null };
    }
    const related = neighborsWithPosition(selection.id, entities, relationships);
    return focusSingleOrFit(related.length > 0 ? related : positionedEntityIds(entities));
  }

  if (selection.type === "relationship") {
    const edge = relationships[selection.index];
    if (!edge) {
      return { selectedEntityId: null, focusEdge: null, fitEntityIds: null };
    }
    return {
      selectedEntityId: null,
      focusEdge: { source: edge.source, target: edge.target },
      fitEntityIds: null,
    };
  }

  if (selection.type === "force") {
    const fitEntityIds = entities
      .filter((entity) =>
        entityHasMapPosition(entity) &&
        (selection.side === "Other"
          ? !["Blue", "Red"].includes(entity.side)
          : entity.side === selection.side),
      )
      .map((entity) => entity.id);
    return { selectedEntityId: null, focusEdge: null, fitEntityIds: fitEntityIds.length ? fitEntityIds : null };
  }

  if (selection.type === "event") {
    const event = events.find((entry) => entry.event_id === selection.id);
    return focusSingleOrFit(resolveEventEntityIds(event, entities));
  }

  if (selection.type === "coa") {
    const coa = findCoa(selection.id, coaLog, frameCoas);
    if (!coa?.target) {
      return { selectedEntityId: null, focusEdge: null, fitEntityIds: null };
    }
    const target = entityByName(entities, coa.target);
    if (entityHasMapPosition(target)) {
      return { selectedEntityId: coa.target, focusEdge: null, fitEntityIds: null };
    }
    return focusSingleOrFit(neighborsWithPosition(coa.target, entities, relationships));
  }

  if (selection.type === "scenario" || selection.type === "environment") {
    const fitEntityIds = positionedEntityIds(entities);
    return { selectedEntityId: null, focusEdge: null, fitEntityIds: fitEntityIds.length ? fitEntityIds : null };
  }

  if (selection.type === "mission") {
    const fitEntityIds = missionEntityIds(entities);
    return { selectedEntityId: null, focusEdge: null, fitEntityIds: fitEntityIds.length ? fitEntityIds : null };
  }

  if (selection.type === "events") {
    const recent = [...events]
      .sort((a, b) => b.tick - a.tick || b.event_id - a.event_id)
      .slice(0, 16);
    const ids = new Set<string>();
    for (const event of recent) {
      for (const id of resolveEventEntityIds(event, entities)) ids.add(id);
    }
    return focusSingleOrFit([...ids]);
  }

  if (selection.type === "coas") {
    const fitEntityIds = coaTargetIds(coaLog, frameCoas, entities);
    return { selectedEntityId: null, focusEdge: null, fitEntityIds: fitEntityIds.length ? fitEntityIds : null };
  }

  if (selection.type === "relationships") {
    const fitEntityIds = relationshipEndpointIds(relationships, entities);
    return { selectedEntityId: null, focusEdge: null, fitEntityIds: fitEntityIds.length ? fitEntityIds : null };
  }

  return { selectedEntityId: null, focusEdge: null, fitEntityIds: null };
}

/** Entity ids to frame on the map for a selected timeline window. */
export function entityIdsForTimelineRange(
  events: SimEvent[],
  range: TickRange | null,
  entities: MapEntity[],
  relationships: RelationshipEdge[] = [],
  coaLog: CourseOfAction[] = [],
): string[] {
  if (!range) return [];

  const ids = new Set<string>();
  const entityByNumericId = new Map(entities.map((entity) => [entity.entity_id, entity.id]));

  for (const event of eventsInRange(events, range)) {
    const actorId = entityByNumericId.get(event.actor);
    if (actorId) ids.add(actorId);

    for (const delta of event.deltas) {
      for (const token of [delta.before, delta.after]) {
        const match = entities.find((entity) => entity.id === token);
        if (match) ids.add(match.id);
      }
    }
  }

  for (const coa of coaLog) {
    if (coa.proposed_tick >= range.start && coa.proposed_tick <= range.end && coa.target) {
      ids.add(coa.target);
    }
  }

  for (const edge of relationships) {
    const source = entities.find((entity) => entity.id === edge.source);
    const target = entities.find((entity) => entity.id === edge.target);
    if (!source || !target) continue;
    if (ids.has(edge.source) || ids.has(edge.target)) {
      ids.add(edge.source);
      ids.add(edge.target);
    }
  }

  return [...ids].filter((id) => entities.some((entity) => entity.id === id && entity.has_position));
}

export function resolveMapFitEntityIds(
  mapFocus: MapFocus,
  timelineRange: TickRange | null,
  timelineFitIds: string[],
): string[] | null {
  if (mapFocus.focusEdge) return null;
  if (mapFocus.selectedEntityId) return null;
  if (mapFocus.fitEntityIds && mapFocus.fitEntityIds.length > 0) {
    return mapFocus.fitEntityIds;
  }
  if (timelineRange && timelineFitIds.length > 0) return timelineFitIds;
  return null;
}

export function selectionRequestsMapFocus(_selection: TreeSelection): boolean {
  return true;
}

export function entityIdsForTimelineRangeFromFrames(
  events: SimEvent[],
  range: TickRange | null,
  entities: MapEntity[],
  relationships: RelationshipEdge[] = [],
  frames: PlaybackFrame[] = [],
  dashboardCoaLog: CourseOfAction[] = [],
): string[] {
  return entityIdsForTimelineRange(
    events,
    range,
    entities,
    relationships,
    buildEffectiveCoaLog(frames, dashboardCoaLog),
  );
}

export function selectionKey(selection: TreeSelection): string {
  switch (selection.type) {
    case "scenario":
      return "scenario";
    case "environment":
      return "environment";
    case "mission":
      return "mission";
    case "force":
      return `force:${selection.side}`;
    case "entity":
      return `entity:${selection.id}`;
    case "relationships":
      return "relationships";
    case "relationship":
      return `relationship:${selection.index}`;
    case "events":
      return "events";
    case "event":
      return `event:${selection.id}`;
    case "coas":
      return "coas";
    case "coa":
      return `coa:${selection.id}`;
  }
}
