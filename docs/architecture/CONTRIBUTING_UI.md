# Contributing to DARLA Studio UI

Before adding a new panel, answer:

1. Which workspace owns it?
2. What shared selection does it respond to?
3. What events does it publish?
4. What backend data is authoritative?
5. Does an existing component already do this?

## No duplicated state

Do not create local selected entity / selected event state if `MissionSelection` can represent it.

## No direct panel coupling

Bad:

```ts
mapPanel.setTimeline(...)
```

Good:

```ts
eventBus.publish({ type: "selection.changed", source: "MapPanel", payload })
```

## Acceptance checklist

- `npm run build` passes.
- Existing routes still load.
- Existing map/timeline functionality preserved.
- New component has a workspace owner.
- New component reads or emits shared selection.
