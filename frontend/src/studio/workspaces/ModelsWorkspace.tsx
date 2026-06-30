export default function ModelsWorkspace(_props: { data?: Record<string, any> }) {
  return (
    <div className="workspace">
      <header className="workspace-header">
        <div>
          <span className="kicker">Models</span>
          <h1>Simulation Model Studio</h1>
          <p>FMU, Python, native C++, behavior, and causal modules belong here.</p>
        </div>
        <div className="button-row">
          <button>Add FMU</button>
          <button>Add Python</button>
          <button>Add Native</button>
        </div>
      </header>

      <div className="models-layout">
        <section className="panel">
          <span className="kicker">Model Library</span>
          <h3>Modules</h3>
          <ul className="event-list">
            <li>uav_flight_dynamics.fmu</li>
            <li>sensor-confidence-v0.yaml</li>
            <li>commander-policy-v0.yaml</li>
            <li>causal_action_estimator</li>
            <li>authority_gate</li>
          </ul>
        </section>

        <section className="code-panel">
          <div className="code-title">mission_logic.py</div>
          <pre>{`from darla import scenario, causal, coa

@scenario.on_tick
def update(t):
    observation = scenario.observe("sensor_confidence")
    causal.update_belief("sensor_degraded", observation)
    coa.evaluate("isolate_compromised_sensor_feed")`}</pre>
        </section>
      </div>
    </div>
  );
}
