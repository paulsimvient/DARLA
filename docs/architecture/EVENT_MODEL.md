# DARLA Studio Event Model

The event model prevents panels from directly controlling each other.

## Event classes

```text
selection.changed
timeline.seek
timeline.window.changed
workspace.changed
layout.changed
command.run
mission.thread.appended
evidence.selected
coa.selected
causal.edge.selected
map.entity.selected
```

## Example

```ts
eventBus.publish({
  type: "selection.changed",
  source: "MapPanel",
  payload: {
    kind: "entity",
    id: "blue_uas_1",
    label: "Blue UAS 1",
    tick: 240
  }
});
```

The inspector, timeline, reasoning panel, and COA board all react independently.

## Rules

1. Components publish events.
2. Components subscribe to events.
3. Components do not call each other.
4. Backend data remains authoritative.
5. The event bus is UI coordination, not mission truth.
