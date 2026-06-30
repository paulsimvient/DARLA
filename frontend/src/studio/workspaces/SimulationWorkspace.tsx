import { getEvents } from "../dataSelectors";

type Props = { data: Record<string, any> };

export default function SimulationWorkspace({ data }: Props) {
  const events = getEvents(data).slice(-8);
  const tick = data?.tick ?? data?.current_tick ?? data?.evidence_package?.tick ?? "—";

  return (
    <div className="workspace">
      <header className="workspace-header">
        <div>
          <span className="kicker">Simulation</span>
          <h1>World State + Playback</h1>
          <p>MapLibre can plug into this slot; current version uses a dependency-free SVG map stand-in.</p>
        </div>
        <div className="button-row">
          <button>Run</button>
          <button>Pause</button>
          <button>Branch</button>
        </div>
      </header>

      <div className="simulation-layout">
        <section className="map-panel">
          <div className="map-grid" />
          <svg className="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M 24 55 C 40 25, 60 30, 72 46" />
            <path d="M 48 29 C 45 44, 35 52, 24 55" />
          </svg>
          <div className="map-node blue" style={{ left: "24%", top: "55%" }}>UAS</div>
          <div className="map-node red" style={{ left: "72%", top: "46%" }}>Target</div>
          <div className="map-node amber" style={{ left: "48%", top: "29%" }}>Cyber</div>
          <div className="map-caption">Simulation map · T+{tick}</div>
        </section>

        <section className="panel">
          <span className="kicker">Events</span>
          <h3>Latest runtime observations</h3>
          <ul className="event-list">
            {(events.length ? events : ["No runtime events exported yet."]).map((event, index) => (
              <li key={index}>
                {typeof event === "string"
                  ? event
                  : `T+${event.tick ?? event.t ?? "?"} ${event.title ?? event.message ?? event.type ?? "event"}`}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
