type Props = {
  dashboardData: Record<string, any>;
};

export default function SimulationApp({ dashboardData }: Props) {
  const tick = dashboardData?.tick ?? dashboardData?.current_tick ?? dashboardData?.evidence_package?.tick ?? "—";

  return (
    <div className="ds-app">
      <header className="ds-app-header">
        <div>
          <span className="ds-kicker">Simulation</span>
          <h1>World + Playback</h1>
        </div>
        <div className="ds-action-group">
          <button>Run</button>
          <button>Pause</button>
          <button>Branch</button>
        </div>
      </header>

      <section className="ds-sim-grid">
        <div className="ds-map-canvas">
          <div className="ds-map-grid" />
          <div className="ds-map-node blue" style={{ left: "32%", top: "42%" }}>UAS</div>
          <div className="ds-map-node red" style={{ left: "63%", top: "47%" }}>Target</div>
          <div className="ds-map-node amber" style={{ left: "48%", top: "28%" }}>Cyber</div>
          <svg className="ds-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M32 42 C45 30, 54 34, 63 47" />
            <path d="M48 28 C50 38, 45 42, 32 42" />
          </svg>
          <div className="ds-map-label">MapLibre slot · T+{tick}</div>
        </div>

        <aside className="ds-panel">
          <span className="ds-kicker">Simulation Objects</span>
          <h3>Entities</h3>
          <ul className="ds-list">
            <li>blue_uas_1</li>
            <li>red_maritime_target</li>
            <li>sensor_feed</li>
            <li>comms_relay</li>
            <li>red_cyber_actor</li>
          </ul>
        </aside>
      </section>

      <section className="ds-panel">
        <span className="ds-kicker">Timeline</span>
        <div className="ds-timeline">
          <span style={{ left: "20%" }}>Cyber effect</span>
          <span style={{ left: "54%" }}>COA gate</span>
          <span style={{ left: "74%" }}>Detection</span>
        </div>
      </section>
    </div>
  );
}
