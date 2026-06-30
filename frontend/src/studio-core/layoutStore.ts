import type { StudioWorkspaceId } from "./selection";

export type StudioPanelId =
  | "explorer"
  | "map"
  | "timeline"
  | "inspector"
  | "mission_thread"
  | "reasoning_graph"
  | "evidence"
  | "coa_board"
  | "model_library"
  | "console"
  | "replay";

export type StudioPanelPlacement = {
  panelId: StudioPanelId;
  region: "left" | "center" | "right" | "bottom";
  order: number;
  size?: number;
  visible: boolean;
};

export type WorkspaceLayout = {
  workspaceId: StudioWorkspaceId;
  panels: StudioPanelPlacement[];
};

const STORAGE_KEY = "darla.studio.v2.layouts";

export const DEFAULT_LAYOUTS: Record<StudioWorkspaceId, WorkspaceLayout> = {
  mission: {
    workspaceId: "mission",
    panels: [
      { panelId: "explorer", region: "left", order: 0, visible: true },
      { panelId: "map", region: "center", order: 0, visible: true },
      { panelId: "inspector", region: "right", order: 0, visible: true },
      { panelId: "timeline", region: "bottom", order: 0, visible: true },
      { panelId: "mission_thread", region: "bottom", order: 1, visible: true },
    ],
  },
  reason: {
    workspaceId: "reason",
    panels: [
      { panelId: "mission_thread", region: "left", order: 0, visible: true },
      { panelId: "reasoning_graph", region: "center", order: 0, visible: true },
      { panelId: "evidence", region: "right", order: 0, visible: true },
      { panelId: "timeline", region: "bottom", order: 0, visible: true },
    ],
  },
  decide: {
    workspaceId: "decide",
    panels: [
      { panelId: "coa_board", region: "center", order: 0, visible: true },
      { panelId: "evidence", region: "right", order: 0, visible: true },
      { panelId: "mission_thread", region: "bottom", order: 0, visible: true },
    ],
  },
  build: {
    workspaceId: "build",
    panels: [
      { panelId: "model_library", region: "left", order: 0, visible: true },
      { panelId: "map", region: "center", order: 0, visible: true },
      { panelId: "inspector", region: "right", order: 0, visible: true },
      { panelId: "console", region: "bottom", order: 0, visible: true },
    ],
  },
  replay: {
    workspaceId: "replay",
    panels: [
      { panelId: "replay", region: "center", order: 0, visible: true },
      { panelId: "mission_thread", region: "right", order: 0, visible: true },
      { panelId: "timeline", region: "bottom", order: 0, visible: true },
    ],
  },
  validation: {
    workspaceId: "validation",
    panels: [
      { panelId: "evidence", region: "center", order: 0, visible: true },
      { panelId: "inspector", region: "right", order: 0, visible: true },
      { panelId: "console", region: "bottom", order: 0, visible: true },
    ],
  },
};

export function loadStudioLayouts(): Record<StudioWorkspaceId, WorkspaceLayout> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUTS;
    return { ...DEFAULT_LAYOUTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_LAYOUTS;
  }
}

export function saveStudioLayouts(layouts: Record<StudioWorkspaceId, WorkspaceLayout>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
}

export function resetStudioLayouts() {
  window.localStorage.removeItem(STORAGE_KEY);
}
