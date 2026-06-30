import React from "react";
import { StudioCoreProvider, useStudioSelection } from "../studio-core/StudioCoreProvider";
import type { MissionSelection } from "../studio-core/selection";

export type DarlaSelectionKind = MissionSelection["kind"];
export type DarlaSelection = MissionSelection;

type LegacySelectionContextValue = {
  selection: DarlaSelection;
  setSelection: (selection: DarlaSelection) => void;
  clearSelection: () => void;
};

const LegacySelectionContext = React.createContext<LegacySelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  return (
    <StudioCoreProvider>
      <SelectionContextBridge>{children}</SelectionContextBridge>
    </StudioCoreProvider>
  );
}

function SelectionContextBridge({ children }: { children: React.ReactNode }) {
  const { selection, setSelection } = useStudioSelection();

  const value = React.useMemo<LegacySelectionContextValue>(
    () => ({
      selection,
      setSelection: (next) => setSelection(next, "LegacySelectionContext"),
      clearSelection: () => setSelection({ kind: "none" }, "LegacySelectionContext"),
    }),
    [selection, setSelection],
  );

  return <LegacySelectionContext.Provider value={value}>{children}</LegacySelectionContext.Provider>;
}

export function useDarlaSelection(): LegacySelectionContextValue {
  const value = React.useContext(LegacySelectionContext);
  if (!value) throw new Error("useDarlaSelection must be used inside SelectionProvider");
  return value;
}
