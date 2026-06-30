# DARLA Studio State Model

DARLA Studio state is UI state, not simulation truth.

## StudioState

```ts
type StudioState = {
  workspaceId: StudioWorkspaceId;
  selection: MissionSelection;
  timeline: TimelineSelection;
  layout: WorkspaceLayoutState;
}
```

## MissionSelection

```ts
type MissionSelection =
  | { kind: "none" }
  | { kind: "entity"; id: string; label?: string; tick?: number; payload?: unknown }
  | { kind: "event"; id: string; label?: string; tick?: number; payload?: unknown }
  | { kind: "coa"; id: string; label?: string; tick?: number; payload?: unknown }
  | { kind: "causal_node"; id: string; label?: string; tick?: number; payload?: unknown }
  | { kind: "causal_edge"; id: string; label?: string; tick?: number; payload?: unknown }
  | { kind: "evidence"; id: string; label?: string; tick?: number; payload?: unknown }
  | { kind: "model"; id: string; label?: string; tick?: number; payload?: unknown }
```

## Rule

There is one active selection.

Panels may have local UI state such as expanded sections, but not separate mission selection.
