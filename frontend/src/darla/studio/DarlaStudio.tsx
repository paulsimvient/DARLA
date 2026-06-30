import { useMemo, useState } from "react";
import MissionApp from "./apps/MissionApp";
import SimulationApp from "./apps/SimulationApp";
import ReasoningApp from "./apps/ReasoningApp";
import ModelsApp from "./apps/ModelsApp";
import AnalysisApp from "./apps/AnalysisApp";
import "./darlaStudio.css";

export type StudioAppId = "mission" | "simulation" | "reasoning" | "models" | "analysis";

type Props = {
  dashboardData: Record<string, any>;
};

const apps: Array<{ id: StudioAppId; label: string; description: string }> = [
  { id: "mission", label: "Mission", description: "Commander view" },
  { id: "simulation", label: "Simulation", description: "World state" },
  { id: "reasoning", label: "Reasoning", description: "Causal pipeline" },
  { id: "models", label: "Models", description: "FMU / Python / C++" },
  { id: "analysis", label: "Analysis", description: "Trust + replay" },
];

function getMissionName(data: Record<string, any>): string {
  return (
    data?.scenario?.name ||
    data?.scenario?.id ||
    data?.scenario_id ||
    data?.mission_id ||
    data?.evidence_package?.mission_id ||
    "UAS Maritime Cyber"
  );
}

export default function DarlaStudio({ dashboardData }: Props) {
  const [activeApp, setActiveApp] = useState<StudioAppId>("mission");

  const missionName = useMemo(() => getMissionName(dashboardData ?? {}), [dashboardData]);
  const tick =
    dashboardData?.tick ??
    dashboardData?.current_tick ??
    dashboardData?.evidence_package?.tick ??
    "—";

  const replayHash =
    dashboardData?.replay_hash ??
    dashboardData?.verification?.replay_hash ??
    dashboardData?.evidence_package?.replay_hash ??
    "unknown";

  return (
    <div className="ds-root">
      <header className="ds-topbar">
        <div className="ds-brand">
          <b>DARLA Studio</b>
          <span>Deterministic Agentic Runtime for Live Analysis</span>
        </div>

        <nav className="ds-nav">
          {apps.map((app) => (
            <button
              key={app.id}
              className={activeApp === app.id ? "active" : ""}
              onClick={() => setActiveApp(app.id)}
              title={app.description}
            >
              {app.label}
            </button>
          ))}
        </nav>

        <div className="ds-run-status">
          <span>LIVE</span>
          <small>T+{tick}</small>
        </div>
      </header>

      <div className="ds-layout">
        <aside className="ds-sidebar">
          <div className="ds-section-title">Scenario</div>
          <div className="ds-scenario-card">
            <b>{missionName}</b>
            <span>Replay {String(replayHash).slice(0, 14)}</span>
          </div>

          <div className="ds-section-title">Workspace</div>
          {apps.map((app) => (
            <button
              key={app.id}
              className={`ds-side-button ${activeApp === app.id ? "active" : ""}`}
              onClick={() => setActiveApp(app.id)}
            >
              <span>{app.label}</span>
              <small>{app.description}</small>
            </button>
          ))}
        </aside>

        <main className="ds-main">
          {activeApp === "mission" && <MissionApp dashboardData={dashboardData} />}
          {activeApp === "simulation" && <SimulationApp dashboardData={dashboardData} />}
          {activeApp === "reasoning" && <ReasoningApp dashboardData={dashboardData} />}
          {activeApp === "models" && <ModelsApp dashboardData={dashboardData} />}
          {activeApp === "analysis" && <AnalysisApp dashboardData={dashboardData} />}
        </main>

        <aside className="ds-inspector">
          <div className="ds-section-title">Inspector</div>
          <div className="ds-inspector-card">
            <b>{apps.find((app) => app.id === activeApp)?.label}</b>
            <p>{apps.find((app) => app.id === activeApp)?.description}</p>
          </div>

          <div className="ds-section-title">Evidence</div>
          <EvidenceMini dashboardData={dashboardData} />
        </aside>
      </div>
    </div>
  );
}

function EvidenceMini({ dashboardData }: { dashboardData: Record<string, any> }) {
  const evidence = dashboardData?.evidence_package ?? {};
  const selected =
    evidence.selected_coa ||
    dashboardData?.decision_layer?.selected_coa ||
    dashboardData?.recommendation?.action_id ||
    "hold";
  const confidence =
    evidence.confidence_score ??
    dashboardData?.decision_layer?.confidence_score ??
    dashboardData?.confidence_score ??
    0;

  return (
    <div className="ds-inspector-card">
      <span className="ds-kicker">Selected COA</span>
      <b>{selected}</b>
      <p>Confidence {Math.round(Number(confidence || 0) * 100)}%</p>
    </div>
  );
}
