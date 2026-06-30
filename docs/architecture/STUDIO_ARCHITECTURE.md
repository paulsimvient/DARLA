# DARLA Studio Architecture

DARLA Studio is a mission engineering environment, not a dashboard.

The frontend is organized around stable workspaces:

```text
Mission | Reason | Decide | Build | Replay | Validation
```

Each workspace is a lens on the same runtime state. Workspaces do not own mission truth. They subscribe to shared state and events.

## Core Principle

No panel should directly coordinate another panel.

Instead:

```text
User action
  -> StudioEventBus
  -> StudioState / MissionSelection
  -> subscribed panels update
```

## Core packages

```text
frontend/src/studio-core/
  eventBus.ts
  selection.ts
  workspaceRegistry.ts
  layoutStore.ts
  commandPalette.ts
  StudioCoreProvider.tsx
```

## Responsibilities

### StudioCoreProvider

Owns the shared Studio runtime.

### EventBus

Publishes selection, timeline, workspace, command, and layout events.

### MissionSelection

Single source of truth for what the user is inspecting.

### WorkspaceRegistry

Defines Mission, Reason, Decide, Build, Replay, and Validation.

### LayoutStore

Persists workspace panel layouts.

### CommandPalette

Executes registered commands without coupling UI components together.

## Workspace contract

Every workspace receives:

```ts
type StudioWorkspaceProps = {
  dashboardData: Record<string, unknown>;
}
```

Every workspace should:
- read shared selection through `useStudioSelection`
- emit events through `useStudioEventBus`
- avoid local duplicated selection state
- use existing components where possible

## Migration rule

Promote existing capability into workspaces. Do not rewrite working features unless the old component prevents integration.
