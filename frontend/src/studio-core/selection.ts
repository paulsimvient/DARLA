export type MissionSelectionKind =
  | "none"
  | "entity"
  | "event"
  | "moment"
  | "coa"
  | "causal_node"
  | "causal_edge"
  | "evidence"
  | "model"
  | "workspace";

export type StudioWorkspaceId =
  | "mission"
  | "reason"
  | "decide"
  | "build"
  | "replay"
  | "validation";

export type MissionSelection = {
  kind: MissionSelectionKind;
  id?: string;
  label?: string;
  tick?: number;
  workspaceId?: StudioWorkspaceId;
  source?: string;
  payload?: unknown;
};

export const emptySelection: MissionSelection = { kind: "none" };

export function selectionLabel(selection: MissionSelection): string {
  if (selection.kind === "none") return "Nothing selected";
  return selection.label ?? selection.id ?? selection.kind;
}
