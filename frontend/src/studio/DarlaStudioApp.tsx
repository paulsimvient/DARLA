import { useMemo, useState } from "react";
import { useDashboardData } from "./useDashboardData";
import MissionWorkspace from "./workspaces/MissionWorkspace";
import SimulationWorkspace from "./workspaces/SimulationWorkspace";
import ReasoningWorkspace from "./workspaces/ReasoningWorkspace";
import ModelsWorkspace from "./workspaces/ModelsWorkspace";
import AnalysisWorkspace from "./workspaces/AnalysisWorkspace";
import EvidenceInspector from "./panels/EvidenceInspector";
import "./studio.css";

export type WorkspaceId = "mission" | "simulation" | "reasoning" | "models" | "analysis";

const workspaces: Array<{ id: WorkspaceId; label: string; short: string }> = [
  { id: "mission", label: "Mission", short: "Commander view" },
  { id: "simulation", label: "Simulation", short: "Map + playback" },
  { id: "reasoning", label: "Reasoning", short: "Causal pipeline" },
  { id: "models", label: "Models", short: "FMU / Python / C++" },
  { id: "analysis", label: "Analysis", short: "Trust + VV&A" },
];

export default function DarlaStudioApp() {
  const [workspace, setWorkspace] = useState<WorkspaceId>("mission");
  const { data, loading, error, refresh } = useDashboardData();

  const scenarioName = useMemo(() => {
    return (
      data?.scenario?.name ||
      data?.scenario?.id ||
      data?.scenario_id ||
      data?.mission_id ||
      data?.evidence_package?.mission_id ||
      "UAS Maritime Cyber"
    );
  }, [data]);

  const tick =
    data?.tick ??
    data?.current_tick ??
    data?.evidence_package?.tick ??
    data?.runtime?.tick ??
    "—";

  return (
    <div className="studio-root">
      <header className="studio-topbar">
        <div className="studio-brand">
          <b>DARLA Studio</b>
          <span>Mission reasoning IDE</span>
        </div>

        <nav className="studio-nav">
          {workspaces.map((item) => (
            <button
              key={item.id}
              className={workspace === item.id ? "active" : ""}
              onClick={() => setWorkspace(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="studio-status">
          <span className={error ? "bad" : loading ? "warn" : "good"}>
            {error ? "API ERROR" : loading ? "LOADING" : "LIVE"}
          </span>
          <small>T+{tick}</small>
          <button onClick={refresh}>Refresh</button>
        </div>
      </header>

      <div className="studio-body">
        <aside className="studio-sidebar">
          <div className="studio-section-label">Scenario</div>
          <div className="studio-card compact">
            <b>{scenarioName}</b>
            <span>{error ? error : "Dashboard JSON connected"}</span>
          </div>

          <div className="studio-section-label">Workspace</div>
          {workspaces.map((item) => (
            <button
              key={item.id}
              className={`studio-side-item ${workspace === item.id ? "active" : ""}`}
              onClick={() => setWorkspace(item.id)}
            >
              <b>{item.label}</b>
              <span>{item.short}</span>
            </button>
          ))}
        </aside>

        <main className="studio-main">
          {workspace === "mission" && <MissionWorkspace data={data} />}
          {workspace === "simulation" && <SimulationWorkspace data={data} />}
          {workspace === "reasoning" && <ReasoningWorkspace data={data} />}
          {workspace === "models" && <ModelsWorkspace data={data} />}
          {workspace === "analysis" && <AnalysisWorkspace data={data} />}
        </main>

        <aside className="studio-inspector">
          <EvidenceInspector data={data} />
        </aside>
      </div>
    </div>
  );
}
