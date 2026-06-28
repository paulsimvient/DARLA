import { useMemo, useState } from "react";
import type { CausalDebugInfo, DashboardData, SimEvent, TemporalCausalEdge } from "./types";

interface Props {
  data: DashboardData;
  events: SimEvent[];
  currentTick: number;
  liveBudgets?: {
    agent_decisions: number;
    causal_queries: number;
    async_replay_jobs: number;
    async_branch_executions: number;
  } | null;
}

function eventLabel(events: SimEvent[], eventId: number): string {
  const event = events.find((e) => e.event_id === eventId);
  if (!event) return `#${eventId}`;
  return event.label || event.type || `#${eventId}`;
}

function impactScore(edge: TemporalCausalEdge): number {
  return edge.strength * edge.confidence;
}

export default function CausalGraphPanel({ data, events, currentTick, liveBudgets }: Props) {
  const [filterByTick, setFilterByTick] = useState(true);
  const [selectedEdge, setSelectedEdge] = useState<number | null>(null);

  const eventById = useMemo(() => new Map(events.map((e) => [e.event_id, e])), [events]);
  const graph = data.temporal_causal_graph ?? [];
  const debug = data.causal_debug;

  const visibleEdges = useMemo(() => {
    if (!filterByTick) return graph;
    return graph.filter(
      (edge) => edge.valid_from <= currentTick && (edge.valid_to === 0 || edge.valid_to >= currentTick),
    );
  }, [graph, filterByTick, currentTick]);

  const selected = selectedEdge != null ? visibleEdges[selectedEdge] : null;

  return (
    <div className="panel causal-graph-panel">
      <div className="causal-graph-header">
        <h2>Temporal Causal Graph</h2>
        <label className="checkbox-label causal-filter">
          <input
            type="checkbox"
            checked={filterByTick}
            onChange={(e) => setFilterByTick(e.target.checked)}
          />
          Active at T+{currentTick}
        </label>
      </div>

      <p className="causal-graph-note">
        Runtime edges recorded by the kernel adjudicator (event → event). Distinct from the static
        scenario relationship graph. Populated after <code>sim-export</code> completes.
      </p>

      {graph.length === 0 ? (
        <div className="causal-empty">No temporal causal graph in export payload.</div>
      ) : (
        <>
          <div className="causal-stats">
            <span>{visibleEdges.length} / {graph.length} edges</span>
            <span>{debug?.dominant_path_labels.length ?? 0} dominant paths</span>
          </div>

          <div className="causal-edge-list">
            {visibleEdges.map((edge, index) => {
              const impact = impactScore(edge);
              const source = eventById.get(edge.source_event_id);
              const target = eventById.get(edge.target_event_id);
              return (
                <button
                  key={`${edge.source_event_id}-${edge.target_event_id}-${edge.label}`}
                  type="button"
                  className={`causal-edge-row${selectedEdge === index ? " causal-edge-selected" : ""}`}
                  onClick={() => setSelectedEdge(selectedEdge === index ? null : index)}
                >
                  <div className="causal-edge-top">
                    <span className={`causal-edge-type type-${edge.type.toLowerCase()}`}>{edge.type}</span>
                    <span className="causal-impact" title="strength × confidence">
                      impact {(impact * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="causal-edge-label">{edge.label || "unnamed edge"}</div>
                  <div className="causal-edge-nodes">
                    <span>T+{source?.tick ?? edge.valid_from} · {eventLabel(events, edge.source_event_id)}</span>
                    <span className="arrow">→</span>
                    <span>T+{target?.tick ?? edge.valid_to} · {eventLabel(events, edge.target_event_id)}</span>
                  </div>
                  <div className="causal-impact-bar">
                    <div className="causal-impact-fill" style={{ width: `${Math.min(100, impact * 100)}%` }} />
                  </div>
                  <div className="causal-edge-meta">
                    strength {edge.strength.toFixed(2)} · confidence {edge.confidence.toFixed(2)}
                    {edge.stale ? " · stale" : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {selected ? (
        <div className="causal-edge-detail">
          <h3>Selected edge impact</h3>
          <div>{selected.label}</div>
          <div className="causal-edge-meta">
            {selected.type}: {eventLabel(events, selected.source_event_id)} causes/affects{" "}
            {eventLabel(events, selected.target_event_id)}
          </div>
        </div>
      ) : null}

      <div className="causal-parent-section">
        <h3>Event parent chains (ledger)</h3>
        <div className="causal-parent-list">
          {events
            .filter((e) => (e.causal_parent_events?.length ?? e.causal_parent_count) > 0)
            .filter((e) => !filterByTick || e.tick <= currentTick)
            .slice(-12)
            .map((event) => (
              <div key={event.event_id} className="causal-parent-row">
                <span className="timeline-tick">T+{event.tick}</span>
                <span className="causal-parent-event">{event.label || event.type}</span>
                <span className="causal-parent-ids">
                  ← {(event.causal_parent_events ?? []).map((id) => eventLabel(events, id)).join(", ") || `${event.causal_parent_count} parents`}
                </span>
              </div>
            ))}
        </div>
      </div>

      <DebugSection debug={debug} replayHash={data.replay_hash} liveBudgets={liveBudgets} />
    </div>
  );
}

function DebugSection({
  debug,
  replayHash,
  liveBudgets,
}: {
  debug?: CausalDebugInfo;
  replayHash: string;
  liveBudgets?: Props["liveBudgets"];
}) {
  if (!debug && !liveBudgets) return null;

  return (
    <details className="causal-debug">
      <summary>Runtime debug</summary>
      <div className="causal-debug-grid">
        <div>
          <div className="debug-label">Replay hash</div>
          <code>{replayHash}</code>
        </div>
        {debug ? (
          <>
            <div>
              <div className="debug-label">Ledger</div>
              {debug.event_count} events · {debug.causal_edge_count} causal edges
            </div>
            <div>
              <div className="debug-label">Dominant paths</div>
              {debug.dominant_path_labels.length > 0
                ? debug.dominant_path_labels.join(" · ")
                : "none"}
            </div>
            <div>
              <div className="debug-label">Budget limits (per tick)</div>
              decisions {debug.budget_limits.agent_decisions_per_tick} · queries{" "}
              {debug.budget_limits.causal_queries_per_tick} · async jobs{" "}
              {debug.budget_limits.async_replay_jobs}
            </div>
            <div>
              <div className="debug-label">Budget usage (run total)</div>
              decisions {debug.budget_total_usage.agent_decisions} · queries{" "}
              {debug.budget_total_usage.causal_queries} · async branches{" "}
              {debug.budget_total_usage.async_branch_executions}
            </div>
            <div>
              <div className="debug-label">Final agent beliefs</div>
              trust {debug.beliefs.sensor_trust.toFixed(2)} · risk {debug.beliefs.mission_risk.toFixed(2)} ·
              entropy {debug.beliefs.coa_entropy.toFixed(2)}
              {debug.beliefs.causal_warning ? " · causal warning" : ""}
              {!debug.beliefs.credibility_valid ? " · credibility invalid" : ""}
            </div>
          </>
        ) : null}
        {liveBudgets ? (
          <div>
            <div className="debug-label">Live tick budget usage</div>
            decisions {liveBudgets.agent_decisions} · queries {liveBudgets.causal_queries} · async{" "}
            {liveBudgets.async_branch_executions}
          </div>
        ) : null}
      </div>
    </details>
  );
}
