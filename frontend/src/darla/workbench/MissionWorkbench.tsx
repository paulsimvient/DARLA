import { useMemo, useState } from "react";
import CoaGateBoard from "./CoaGateBoard";
import EvidenceTracePanel from "./EvidenceTracePanel";
import "./MissionWorkbench.css";

type Props = {
  dashboardData: Record<string, any>;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function getScenarioName(data: Record<string, any>): string {
  return (
    data?.scenario?.name ||
    data?.scenario?.id ||
    data?.scenario_id ||
    data?.mission_id ||
    "UAS Maritime Cyber"
  );
}

function getRecommendation(data: Record<string, any>) {
  const evidence = data?.evidence_package ?? {};
  const rec = data?.recommendation ?? {};
  const selected =
    evidence.selected_coa ||
    rec.selected_coa ||
    rec.action_id ||
    data?.selected_coa ||
    "hold";

  const confidence =
    evidence.confidence_score ??
    rec.confidence_score ??
    data?.confidence_score ??
    0;

  const caveats = asArray<string>(evidence.caveats ?? rec.caveats ?? data?.caveats);

  return { selected, confidence, caveats };
}

export default function MissionWorkbench({ dashboardData }: Props) {
  const [tab, setTab] = useState<"overview" | "coa" | "evidence" | "raw">("overview");

  const scenarioName = useMemo(() => getScenarioName(dashboardData), [dashboardData]);
  const recommendation = useMemo(() => getRecommendation(dashboardData), [dashboardData]);

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
    <main className="mw-shell">
      <header className="mw-header">
        <div>
          <div className="mw-kicker">DARLA Mission Workbench</div>
          <h1>{scenarioName}</h1>
          <p>
            Formal path: observation → belief update → causal support → counterfactual test →
            COA gate → evidence-backed recommendation.
          </p>
        </div>

        <div className="mw-status">
          <span>Tick {tick}</span>
          <span>Replay {String(replayHash).slice(0, 12)}</span>
        </div>
      </header>

      <section className="mw-recommendation">
        <div>
          <div className="mw-kicker">Current Recommendation</div>
          <h2>{recommendation.selected}</h2>
          <p>
            Confidence {Math.round(Number(recommendation.confidence || 0) * 100)}%
            {recommendation.caveats.length ? ` · ${recommendation.caveats[0]}` : ""}
          </p>
        </div>
        <div className="mw-rec-actions">
          <button>Approve</button>
          <button>Hold</button>
          <button>Open Evidence</button>
        </div>
      </section>

      <nav className="mw-tabs">
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>
          Overview
        </button>
        <button className={tab === "coa" ? "active" : ""} onClick={() => setTab("coa")}>
          COA Gates
        </button>
        <button className={tab === "evidence" ? "active" : ""} onClick={() => setTab("evidence")}>
          Evidence Trace
        </button>
        <button className={tab === "raw" ? "active" : ""} onClick={() => setTab("raw")}>
          Raw
        </button>
      </nav>

      {tab === "overview" && (
        <section className="mw-grid">
          <article className="mw-card">
            <div className="mw-kicker">What is happening?</div>
            <h3>Sensor degradation is delaying target detection</h3>
            <p>
              DARLA should surface the mission condition first, then expose causal and statistical support
              through drill-downs.
            </p>
          </article>

          <article className="mw-card">
            <div className="mw-kicker">Why?</div>
            <h3>Causal support links cyber effect to sensor confidence</h3>
            <p>
              The UI should emphasize evidence path and confidence, not dump every intermediate gate.
            </p>
          </article>

          <article className="mw-card">
            <div className="mw-kicker">What now?</div>
            <h3>Rank COAs by support, resource, authority, and preconditions</h3>
            <p>
              The commander sees a compact gate board; full evidence remains one click away.
            </p>
          </article>
        </section>
      )}

      {tab === "coa" && <CoaGateBoard dashboardData={dashboardData} />}

      {tab === "evidence" && <EvidenceTracePanel dashboardData={dashboardData} />}

      {tab === "raw" && (
        <pre className="mw-raw">{JSON.stringify(dashboardData, null, 2)}</pre>
      )}
    </main>
  );
}
