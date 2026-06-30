import type { StudioWorkspaceId } from "./selection";

export type StudioWorkspaceDefinition = {
  id: StudioWorkspaceId;
  label: string;
  description: string;
  legacyRoute?: string;
  primaryRoute: string;
};

export const STUDIO_WORKSPACES: StudioWorkspaceDefinition[] = [
  { id: "mission", label: "Mission", description: "Operational picture, map, timeline, explorer, replay", legacyRoute: "/overview", primaryRoute: "/mission" },
  { id: "reason", label: "Reason", description: "Mission reasoning debugger, evidence chain, counterfactuals", legacyRoute: "/causal", primaryRoute: "/reason" },
  { id: "decide", label: "Decide", description: "COAs, gates, authority, risk, recommendation", legacyRoute: "/coas", primaryRoute: "/decide" },
  { id: "build", label: "Build", description: "Modules, FMUs, agents, scripts, scenario assets", legacyRoute: "/modules", primaryRoute: "/build" },
  { id: "replay", label: "Replay", description: "Mission, reasoning, decision, and evidence replay", legacyRoute: "/overview", primaryRoute: "/replay" },
  { id: "validation", label: "Validation", description: "Evaluation, realism, credibility, VV&A", legacyRoute: "/evaluation", primaryRoute: "/validation" },
];

export function getWorkspace(id: StudioWorkspaceId): StudioWorkspaceDefinition {
  return STUDIO_WORKSPACES.find((workspace) => workspace.id === id) ?? STUDIO_WORKSPACES[0];
}
