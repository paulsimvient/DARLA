import type { StudioEventBus } from "./eventBus";
import type { StudioWorkspaceId } from "./selection";

export type StudioCommand = {
  id: string;
  label: string;
  description?: string;
  group: "workspace" | "selection" | "layout" | "simulation" | "debug";
  run: (ctx: { eventBus: StudioEventBus }) => void;
};

export function createDefaultCommands(): StudioCommand[] {
  const workspaceCommand = (workspaceId: StudioWorkspaceId, label: string): StudioCommand => ({
    id: `workspace.${workspaceId}`,
    label,
    group: "workspace",
    run: ({ eventBus }) => {
      eventBus.publish({
        type: "workspace.changed",
        source: "CommandPalette",
        payload: { workspaceId },
      });
    },
  });

  return [
    workspaceCommand("mission", "Open Mission Workspace"),
    workspaceCommand("reason", "Open Reason Workspace"),
    workspaceCommand("decide", "Open Decide Workspace"),
    workspaceCommand("build", "Open Build Workspace"),
    workspaceCommand("replay", "Open Replay Workspace"),
    workspaceCommand("validation", "Open Validation Workspace"),
    {
      id: "selection.clear",
      label: "Clear Selection",
      group: "selection",
      run: ({ eventBus }) => {
        eventBus.publish({
          type: "selection.changed",
          source: "CommandPalette",
          payload: { kind: "none" },
        });
      },
    },
  ];
}
