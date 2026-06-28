import Badge from "./Badge";
import MetricRow from "./MetricRow";
import EventDetailPanel from "./replay/EventDetailPanel";
import { SCENARIOS, useSimulation } from "../context/SimulationContext";
import type { CourseOfAction, SimEvent } from "../types";
import type { TreeSelection } from "../types/selection";
import { scenarioEnvironment } from "../utils/scenarioProfile";

type InspectorPanelProps = {
  selection: TreeSelection;
  onSelect?: (selection: TreeSelection) => void;
  onOpenEventCausal?: (event: SimEvent) => void;
};

export default function InspectorPanel({ selection, onSelect, onOpenEventCausal }: InspectorPanelProps) {
  const {
    scenario,
    dashboard,
    entities,
    relationships,
    events,
    currentTick,
    currentFrame,
    status,
    coasAtCurrentTick,
    playback,
    setCurrentTick,
    simulateWhatIf,
  } = useSimulation();
  const scenarioMeta = SCENARIOS.find((s) => s.id === scenario) ?? SCENARIOS[0];
  const tickSeconds = playback?.tick_seconds ?? 1;

  const handleBranchFromEvent = async (event: SimEvent, coa: CourseOfAction | null) => {
    setCurrentTick(event.tick);
    if (coa) {
      await simulateWhatIf(coa, event.tick);
      return;
    }
    throw new Error("No COA available to branch from this event.");
  };

  return (
    <aside className="darla-scroll flex h-full w-full flex-col overflow-y-auto bg-darla-surface">
      <header className="border-b border-darla-border px-4 py-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-darla-text-muted">
          Object inspector
        </h2>
        <p className="mt-1 text-sm font-semibold text-darla-text">{inspectorTitle(selection)}</p>
        <p className="text-[11px] text-darla-text-muted">
          T+{currentTick} · {status}
        </p>
      </header>

      <div className="space-y-4 p-4">
        <InspectorBody
          selection={selection}
          scenarioMeta={scenarioMeta}
          dashboard={dashboard}
          entities={entities}
          relationships={relationships}
          events={events}
          currentFrame={currentFrame}
          coasAtCurrentTick={coasAtCurrentTick}
          scenarioPath={scenario}
          tickSeconds={tickSeconds}
          missionCutoff={dashboard?.mission_cutoff ?? playback?.mission_cutoff ?? 0}
          onOpenEventCausal={onOpenEventCausal}
          onBranchFromEvent={handleBranchFromEvent}
          onSelectCoa={(coaId) => onSelect?.({ type: "coa", id: coaId })}
        />
      </div>
    </aside>
  );
}

function inspectorTitle(selection: TreeSelection): string {
  switch (selection.type) {
    case "scenario":
      return "Scenario";
    case "environment":
      return "Environment";
    case "mission":
      return "Mission";
    case "force":
      return `${selection.side} Forces`;
    case "entity":
      return selection.id;
    case "relationships":
      return "Relationships";
    case "relationship":
      return "Relationship Edge";
    case "events":
      return "Events";
    case "event":
      return "Event";
    case "coas":
      return "Courses of Action";
    case "coa":
      return "Course of Action";
  }
}

function InspectorBody({
  selection,
  scenarioMeta,
  dashboard,
  entities,
  relationships,
  events,
  currentFrame,
  coasAtCurrentTick,
  scenarioPath,
  tickSeconds,
  missionCutoff,
  onOpenEventCausal,
  onBranchFromEvent,
  onSelectCoa,
}: {
  selection: TreeSelection;
  scenarioMeta: (typeof SCENARIOS)[number];
  dashboard: ReturnType<typeof useSimulation>["dashboard"];
  entities: ReturnType<typeof useSimulation>["entities"];
  relationships: ReturnType<typeof useSimulation>["relationships"];
  events: ReturnType<typeof useSimulation>["events"];
  currentFrame: ReturnType<typeof useSimulation>["currentFrame"];
  coasAtCurrentTick: ReturnType<typeof useSimulation>["coasAtCurrentTick"];
  scenarioPath: string;
  tickSeconds?: number;
  missionCutoff: number;
  onOpenEventCausal?: (event: SimEvent) => void;
  onBranchFromEvent?: (event: SimEvent, coa: CourseOfAction | null) => Promise<void>;
  onSelectCoa?: (coaId: number) => void;
}) {
  switch (selection.type) {
    case "scenario":
      return (
        <Section title="Scenario">
          <MetricRow label="Name" value={scenarioMeta.label} />
          <MetricRow label="Theater" value={scenarioMeta.subtitle} />
          <MetricRow label="Scenario ID" value={dashboard?.scenario_id ?? scenarioMeta.id} />
          <MetricRow label="Seed" value={String(dashboard?.seed ?? "—")} padValue />
          <MetricRow label="Max ticks" value={dashboard ? `T+${dashboard.max_ticks}` : "—"} />
          <MetricRow label="Cutoff" value={dashboard ? `T+${dashboard.mission_cutoff}` : "—"} />
          <MetricRow label="Entities" value={String(entities.length).padStart(2, "0")} padValue />
          <MetricRow label="Events" value={String(events.length)} />
        </Section>
      );

    case "environment": {
      const env = scenarioEnvironment(scenarioPath, dashboard, tickSeconds);
      return (
        <>
          <Section title="Environment">
            <MetricRow label="Theater" value={env.theater} />
            <MetricRow label="Weather" value={env.weather} />
            <MetricRow label="Sea state" value={env.seaState} />
            <MetricRow label="Wind" value={env.wind} />
            <MetricRow label="Visibility" value={env.visibility} />
            <MetricRow label="Tick rate" value={`${env.tickSeconds}s / tick`} />
          </Section>
          <Section title="Mission profile">
            <MetricRow label="Objective" value={env.missionObjective} />
          </Section>
          {env.emergenceSummary ? (
            <Section title="Live emergence">
              <MetricRow label="Summary" value={env.emergenceSummary} />
              {env.liveSensorTrust != null ? (
                <MetricRow label="Sensor trust" value={env.liveSensorTrust.toFixed(3)} />
              ) : null}
              {env.liveCommsCongestion != null ? (
                <MetricRow label="Comms congestion" value={env.liveCommsCongestion.toFixed(3)} />
              ) : null}
              {env.liveMissionTempo != null ? (
                <MetricRow label="Mission tempo" value={env.liveMissionTempo.toFixed(3)} />
              ) : null}
            </Section>
          ) : null}
        </>
      );
    }

    case "mission":
      return dashboard ? (
        <>
          <Section title="Baseline metrics">
            <MetricRow
              label="Target detected"
              value={
                dashboard.baseline_metrics.target_detected
                  ? `T+${dashboard.baseline_metrics.detection_time}`
                  : "No"
              }
            />
            <MetricRow
              label="Success score"
              value={dashboard.baseline_metrics.mission_success_score.toFixed(2)}
            />
            <MetricRow
              label="Mission success"
              value={dashboard.baseline_metrics.mission_success ? "Yes" : "No"}
            />
            <MetricRow
              label="COA selection"
              value={`T+${dashboard.baseline_metrics.coa_selection_time}`}
            />
          </Section>
          <Section title="Intervention search">
            <MetricRow
              label="Lowest cost"
              value={dashboard.intervention_search.lowest_cost_effective.options}
            />
            <MetricRow
              label="Effect"
              value={dashboard.intervention_search.lowest_cost_effective.estimated_effect.toFixed(2)}
            />
            <MetricRow
              label="Mission score"
              value={dashboard.intervention_search.lowest_cost_effective.mission_score.toFixed(2)}
            />
          </Section>
          {currentFrame ? (
            <Section title="Live frame">
              <MetricRow
                label="Score"
                value={currentFrame.metrics.mission_success_score.toFixed(2)}
              />
              <MetricRow
                label="Detected"
                value={
                  currentFrame.metrics.target_detected
                    ? `T+${currentFrame.metrics.detection_time}`
                    : "No"
                }
              />
            </Section>
          ) : null}
        </>
      ) : (
        <EmptyState message="Loading mission export…" />
      );

    case "force": {
      const forceEntities = entities.filter((e) =>
        selection.side === "Other" ? !["Blue", "Red"].includes(e.side) : e.side === selection.side,
      );
      return (
        <>
          <Section title={`${selection.side} force summary`}>
            <MetricRow label="Entity count" value={String(forceEntities.length)} />
            <MetricRow
              label="Platforms"
              value={String(forceEntities.filter((e) => e.kind === "Platform").length)}
            />
            <MetricRow
              label="Sensors"
              value={String(forceEntities.filter((e) => e.sensor_range_km).length)}
            />
          </Section>
          <Section title="Entities">
            {forceEntities.map((entity) => (
              <div key={entity.id} className="mb-2 rounded-lg border border-darla-border bg-darla-panel p-2">
                <div className="text-xs font-medium text-darla-text">{entity.id}</div>
                <div className="text-[10px] text-darla-text-muted">
                  {entity.kind} ·{" "}
                  {entity.has_position
                    ? `${entity.lat?.toFixed(2)}°, ${entity.lon?.toFixed(2)}°`
                    : "no position"}
                </div>
              </div>
            ))}
          </Section>
        </>
      );
    }

    case "entity": {
      const entity = entities.find((e) => e.id === selection.id);
      if (!entity) return <EmptyState message="Entity not found in current frame." />;
      const entityLinks = relationships.filter(
        (r) => r.source === entity.id || r.target === entity.id,
      );
      return (
        <>
          <Section title="Identity">
            <MetricRow label="ID" value={entity.id} />
            <MetricRow label="Kind" value={entity.kind} />
            <MetricRow label="Side" value={entity.side} />
            <MetricRow label="Entity ID" value={String(entity.entity_id)} />
          </Section>
          <Section title="Position">
            <MetricRow
              label="Coordinates"
              value={
                entity.has_position && entity.lat != null && entity.lon != null
                  ? `${entity.lat.toFixed(4)}°, ${entity.lon.toFixed(4)}°`
                  : "Unknown"
              }
            />
            <MetricRow label="Altitude" value={entity.alt != null ? `${entity.alt} m` : "—"} />
          </Section>
          {(entity.sensor_range_km || entity.sensor_confidence != null) && (
            <Section title="Sensor">
              <MetricRow
                label="Range"
                value={entity.sensor_range_km ? `${entity.sensor_range_km} km` : "—"}
              />
              <MetricRow label="Confidence" value={entity.sensor_confidence?.toFixed(2) ?? "—"} />
              <MetricRow label="Degraded" value={entity.sensor_degraded ? "Yes" : "No"} />
              <MetricRow label="Isolated" value={entity.sensor_isolated ? "Yes" : "No"} />
            </Section>
          )}
          <Section title={`Links (${entityLinks.length})`}>
            {entityLinks.length === 0 ? (
              <p className="text-xs text-darla-text-muted">No relationship edges.</p>
            ) : (
              entityLinks.map((link, i) => (
                <div key={i} className="mb-2 text-[11px] text-darla-text-secondary">
                  <Badge tone="neutral">{link.type}</Badge>
                  <div className="mt-1 font-mono">
                    {link.source} → {link.target}
                  </div>
                  {link.component ? (
                    <div className="text-darla-text-muted">component: {link.component}</div>
                  ) : null}
                </div>
              ))
            )}
          </Section>
        </>
      );
    }

    case "relationships":
      return (
        <Section title="All relationships">
          {relationships.map((edge, index) => (
            <div
              key={index}
              className="mb-2 rounded-lg border border-darla-border bg-darla-panel p-2 text-[11px]"
            >
              <Badge tone="blue">{edge.type}</Badge>
              <div className="mt-1 font-mono text-darla-text">
                {edge.source} → {edge.target}
              </div>
            </div>
          ))}
        </Section>
      );

    case "relationship": {
      const edge = relationships[selection.index];
      if (!edge) return <EmptyState message="Relationship not found." />;
      return (
        <Section title="Edge">
          <MetricRow label="Type" value={edge.type} />
          <MetricRow label="Source" value={edge.source} />
          <MetricRow label="Target" value={edge.target} />
          <MetricRow label="Component" value={edge.component || "—"} />
        </Section>
      );
    }

    case "events":
      return (
        <Section title="Recent events">
          {[...events]
            .sort((a, b) => b.tick - a.tick)
            .slice(0, 24)
            .map((event) => (
              <div
                key={event.event_id}
                className="mb-2 rounded-lg border border-darla-border bg-darla-panel p-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-darla-text">
                    {event.label || event.type}
                  </span>
                  <span className="font-mono text-[10px] text-darla-text-muted">T+{event.tick}</span>
                </div>
                <div className="mt-1 text-[10px] text-darla-text-muted">
                  {event.type} · {Math.round(event.confidence * 100)}% · {event.provenance}
                </div>
              </div>
            ))}
        </Section>
      );

    case "event": {
      const event = events.find((e) => e.event_id === selection.id);
      if (!event) return <EmptyState message="Event not found." />;
      return (
        <EventDetailPanel
          event={event}
          missionCutoff={missionCutoff}
          coaLog={dashboard?.coa_log}
          onOpenCausal={onOpenEventCausal ? () => onOpenEventCausal(event) : undefined}
          onBranch={onBranchFromEvent}
          onSelectCoa={onSelectCoa}
        />
      );
    }

    case "coas": {
      const coas = coasAtCurrentTick;
      return (
        <Section title="COA list">
          {coas.length === 0 ? (
            <EmptyState message="No COA recommendations at current tick." />
          ) : (
            coas.map((coa) => (
              <div key={coa.id} className="mb-2 rounded-lg border border-darla-border bg-darla-panel p-2">
                <div className="text-xs font-semibold text-darla-text">{coa.action}</div>
                <div className="mt-1 text-[10px] text-darla-text-muted">
                  score {coa.score.toFixed(3)} · {coa.status} · T+{coa.proposed_tick}
                </div>
              </div>
            ))
          )}
        </Section>
      );
    }

    case "coa": {
      const coa =
        coasAtCurrentTick.find((c) => c.id === selection.id) ??
        dashboard?.coa_log?.find((c) => c.id === selection.id);
      if (!coa) return <EmptyState message="COA not found." />;
      return (
        <>
          <Section title="COA">
            <MetricRow label="Action" value={coa.action} />
            <MetricRow label="Target" value={coa.target} />
            <MetricRow label="Status" value={coa.status} />
            <MetricRow label="Score" value={coa.score.toFixed(3)} />
            <MetricRow label="Mission gain" value={coa.expected_mission_gain.toFixed(3)} />
            <MetricRow label="Causal confidence" value={coa.causal_confidence.toFixed(3)} />
            <MetricRow label="Cost" value={String(coa.cost)} />
            <MetricRow label="Risk" value={coa.risk.toFixed(3)} />
            <MetricRow label="Proposed" value={`T+${coa.proposed_tick}`} />
            <MetricRow label="Scheduled" value={`T+${coa.scheduled_at_tick}`} />
          </Section>
          <Section title="Rationale">
            <p className="text-xs leading-relaxed text-darla-text-secondary">{coa.rationale}</p>
          </Section>
        </>
      );
    }
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-darla-text-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-xs text-darla-text-muted">{message}</p>;
}
