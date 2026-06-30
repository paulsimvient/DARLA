import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { studioEventBus, type StudioEventBus } from "./eventBus";
import { createDefaultCommands, type StudioCommand } from "./commandRegistry";
import { emptySelection, type MissionSelection, type StudioWorkspaceId } from "./selection";
import { loadStudioLayouts, saveStudioLayouts, type WorkspaceLayout } from "./layoutStore";

type StudioCoreContextValue = {
  eventBus: StudioEventBus;
  workspaceId: StudioWorkspaceId;
  setWorkspaceId: (workspaceId: StudioWorkspaceId) => void;
  selection: MissionSelection;
  setSelection: (selection: MissionSelection, source?: string) => void;
  layouts: Record<StudioWorkspaceId, WorkspaceLayout>;
  setLayout: (workspaceId: StudioWorkspaceId, layout: WorkspaceLayout) => void;
  commands: StudioCommand[];
};

const StudioCoreContext = createContext<StudioCoreContextValue | null>(null);

export function StudioCoreProvider({
  children,
  initialWorkspace = "mission",
}: {
  children: React.ReactNode;
  initialWorkspace?: StudioWorkspaceId;
}) {
  const [workspaceId, setWorkspaceIdState] = useState<StudioWorkspaceId>(initialWorkspace);
  const [selection, setSelectionState] = useState<MissionSelection>(emptySelection);
  const [layouts, setLayouts] = useState(() => loadStudioLayouts());
  const commands = useMemo(() => createDefaultCommands(), []);

  const setWorkspaceId = useCallback((next: StudioWorkspaceId) => {
    setWorkspaceIdState(next);
    studioEventBus.publish({
      type: "workspace.changed",
      source: "StudioCoreProvider",
      payload: { workspaceId: next },
    });
  }, []);

  const setSelection = useCallback((next: MissionSelection, source = "StudioCoreProvider") => {
    setSelectionState(next);
    studioEventBus.publish({
      type: "selection.changed",
      source,
      payload: next,
    });
  }, []);

  const setLayout = useCallback((workspace: StudioWorkspaceId, layout: WorkspaceLayout) => {
    setLayouts((prev) => {
      const next = { ...prev, [workspace]: layout };
      saveStudioLayouts(next);
      return next;
    });
    studioEventBus.publish({
      type: "layout.changed",
      source: "StudioCoreProvider",
      payload: { workspaceId: workspace },
    });
  }, []);

  const value = useMemo<StudioCoreContextValue>(
    () => ({
      eventBus: studioEventBus,
      workspaceId,
      setWorkspaceId,
      selection,
      setSelection,
      layouts,
      setLayout,
      commands,
    }),
    [workspaceId, setWorkspaceId, selection, setSelection, layouts, setLayout, commands],
  );

  return <StudioCoreContext.Provider value={value}>{children}</StudioCoreContext.Provider>;
}

export function useStudioCore(): StudioCoreContextValue {
  const value = useContext(StudioCoreContext);
  if (!value) throw new Error("useStudioCore must be used inside StudioCoreProvider");
  return value;
}

export function useStudioSelection() {
  const { selection, setSelection } = useStudioCore();
  return { selection, setSelection };
}

export function useStudioEventBus() {
  return useStudioCore().eventBus;
}
