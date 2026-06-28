import type { AuthorityStatus, CourseOfAction, MapEntity, MissionMetrics, SimEvent, SimMapOverlay, TemporalCausalEdge } from "./types";

export interface PlaybackFrame {
  tick: number;
  metrics: MissionMetrics;
  entities: MapEntity[];
  agent_beliefs?: {
    sensor_trust: number;
    sensor_degraded: boolean;
    comms_health: number;
    mission_risk: number;
    tempo_ratio: number;
    causal_warning: boolean;
    credibility_valid: boolean;
  };
  authority_status?: AuthorityStatus;
  active_coa?: CourseOfAction | null;
  coa_recommendations?: CourseOfAction[];
  budgets?: {
    agent_decisions: number;
    causal_queries: number;
    async_replay_jobs: number;
    async_branch_executions: number;
  };
  events: SimEvent[];
  temporal_causal_edges?: TemporalCausalEdge[];
  map_overlays?: SimMapOverlay[];
  run_id?: string;
  branch_id?: string;
  replay_hash?: string;
  authorization_mode?: string;
  current_tick?: number;
}

export interface PlaybackData {
  scenario_id: string;
  seed: number;
  authorization_mode?: string;
  max_ticks: number;
  tick_seconds: number;
  mission_cutoff: number;
  final_tick: number;
  frames: PlaybackFrame[];
}

export function frameAtTick(frames: PlaybackFrame[], tick: number): PlaybackFrame | null {
  if (frames.length === 0) {
    return null;
  }
  let best = frames[0];
  for (const frame of frames) {
    if (frame.tick <= tick) {
      best = frame;
    } else {
      break;
    }
  }
  return best;
}

export function eventsUpToTick(frames: PlaybackFrame[], tick: number): SimEvent[] {
  const seen = new Map<number, SimEvent>();
  for (const frame of frames) {
    if (frame.tick > tick) break;
    for (const event of frame.events) {
      seen.set(event.event_id, event);
    }
  }
  return [...seen.values()].sort((a, b) => a.tick - b.tick || a.event_id - b.event_id);
}

export function decisionPointTicks(frames: PlaybackFrame[]): number[] {
  const ticks = new Set<number>();
  for (const frame of frames) {
    for (const event of frame.events) {
      if (event.label === "coa_recommendation" || event.label === "online_agent_decision") {
        ticks.add(event.tick);
      }
    }
  }
  return [...ticks].sort((a, b) => a - b);
}
