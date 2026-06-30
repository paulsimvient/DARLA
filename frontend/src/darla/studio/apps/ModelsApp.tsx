export default function ModelsApp(_props: { dashboardData?: Record<string, any> }) {
  return (
    <div className="ds-app">
      <header className="ds-app-header">
        <div>
          <span className="ds-kicker">Models</span>
          <h1>Simulation Model Studio</h1>
        </div>
        <div className="ds-action-group">
          <button>Add FMU</button>
          <button>Add Python</button>
          <button>Add Native Module</button>
        </div>
      </header>

      <section className="ds-model-layout">
        <aside className="ds-panel">
          <span className="ds-kicker">Library</span>
          <h3>Modules</h3>
          <ul className="ds-list">
            <li>uav_flight_dynamics.fmu</li>
            <li>sensor_confidence_model</li>
            <li>comms_degradation_model</li>
            <li>causal_action_estimator</li>
            <li>authority_gate</li>
          </ul>
        </aside>

        <section className="ds-code-panel">
          <div className="ds-code-title">mission_logic.py</div>
          <pre>{`from darla import scenario, causal, coa

@scenario.on_tick
def update(t):
    obs = scenario.observe("sensor_confidence")
    causal.update_belief("sensor_degraded", obs)
    coa.evaluate("isolate_compromised_sensor_feed")`}</pre>
        </section>
      </section>
    </div>
  );
}
