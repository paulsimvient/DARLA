import type { MissionSelection, StudioWorkspaceId } from "./selection";

export type StudioEvent =
  | { type: "selection.changed"; source: string; payload: MissionSelection }
  | { type: "workspace.changed"; source: string; payload: { workspaceId: StudioWorkspaceId } }
  | { type: "timeline.seek"; source: string; payload: { tick: number } }
  | { type: "timeline.window.changed"; source: string; payload: { startTick: number; endTick: number } }
  | { type: "layout.changed"; source: string; payload: { workspaceId: StudioWorkspaceId; layoutId?: string } }
  | { type: "command.run"; source: string; payload: { commandId: string; args?: unknown } }
  | {
      type: "mission.thread.appended";
      source: string;
      payload: { tick?: number; title: string; body?: string; payload?: unknown };
    };

type Listener = (event: StudioEvent) => void;

export class StudioEventBus {
  private listeners = new Set<Listener>();
  private history: StudioEvent[] = [];

  publish(event: StudioEvent) {
    this.history.push(event);
    if (this.history.length > 500) this.history.shift();

    for (const listener of this.listeners) {
      listener(event);
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getHistory(): StudioEvent[] {
    return [...this.history];
  }
}

export const studioEventBus = new StudioEventBus();
