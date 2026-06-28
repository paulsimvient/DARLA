import type { DashboardData } from "../types";

export type ScenarioEnvironment = {
  theater: string;
  weather: string;
  seaState: string;
  wind: string;
  visibility: string;
  tickSeconds: number;
  missionObjective: string;
  liveSensorTrust?: number;
  liveCommsCongestion?: number;
  liveMissionTempo?: number;
  emergenceSummary?: string;
};

const PROFILES: Record<
  string,
  Omit<ScenarioEnvironment, "liveSensorTrust" | "liveCommsCongestion" | "liveMissionTempo" | "emergenceSummary">
> = {
  "scenarios/uas-maritime-cyber/scenario.yaml": {
    theater: "Taiwan Strait",
    weather: "Maritime baseline — clear to partly cloudy",
    seaState: "Sea state 2 (moderate swell)",
    wind: "12 kts NE",
    visibility: "15 km",
    tickSeconds: 1,
    missionObjective: "Detect and track red maritime target before T+1800",
  },
  "scenarios/uas-maritime-cyber/comms-only.yaml": {
    theater: "Taiwan Strait (comms stress)",
    weather: "Maritime baseline — haze possible",
    seaState: "Sea state 2 (moderate swell)",
    wind: "10 kts E",
    visibility: "12 km",
    tickSeconds: 1,
    missionObjective: "Detect and track red maritime target with comms degradation branch",
  },
  "scenarios/taiwan-maritime-open-data/scenario.yaml": {
    theater: "Taiwan Strait",
    weather: "Partly cloudy · Open-Meteo ERA5 snapshot",
    seaState: "Sea state 2 (moderate swell)",
    wind: "11.5 kts NE",
    visibility: "14.2 km",
    tickSeconds: 1,
    missionObjective: "Detect and track red maritime target with open-data background traffic",
  },
};

/** Fallback timeline bounds when SSE meta / dashboard export have not arrived yet. */
const TIMELINE_DEFAULTS: Record<string, { max_ticks: number; mission_cutoff: number }> = {
  "scenarios/uas-maritime-cyber/scenario.yaml": { max_ticks: 5000, mission_cutoff: 1800 },
  "scenarios/uas-maritime-cyber/fmu-stub.yaml": { max_ticks: 100, mission_cutoff: 1800 },
  "scenarios/uas-maritime-cyber/comms-only.yaml": { max_ticks: 5000, mission_cutoff: 1800 },
  "scenarios/taiwan-maritime-open-data/scenario.yaml": { max_ticks: 5000, mission_cutoff: 1800 },
};

export function scenarioTimelineDefaults(scenarioPath: string): {
  max_ticks: number;
  mission_cutoff: number;
} {
  return TIMELINE_DEFAULTS[scenarioPath] ?? { max_ticks: 5000, mission_cutoff: 1800 };
}

export function scenarioEnvironment(
  scenarioPath: string,
  dashboard: DashboardData | null,
  tickSeconds?: number,
): ScenarioEnvironment {
  const base =
    PROFILES[scenarioPath] ??
    ({
      theater: dashboard?.scenario_id ?? "Unknown theater",
      weather: "Scenario default",
      seaState: "Not modeled in export",
      wind: "Not modeled in export",
      visibility: "Not modeled in export",
      tickSeconds: tickSeconds ?? 1,
      missionObjective: dashboard?.scenario_id ?? "—",
    } satisfies Omit<
      ScenarioEnvironment,
      "liveSensorTrust" | "liveCommsCongestion" | "liveMissionTempo" | "emergenceSummary"
    >);

  const env = dashboard?.environment;
  const merged = env
    ? {
        ...base,
        theater: env.theater || base.theater,
        weather: env.weather_summary || base.weather,
        seaState: env.sea_state ? `Sea state ${env.sea_state}` : base.seaState,
        wind: env.wind_kts
          ? `${env.wind_kts} kts ${env.wind_direction || ""}`.trim()
          : base.wind,
        visibility: env.visibility_km ? `${env.visibility_km} km` : base.visibility,
      }
    : base;

  const emergence = dashboard?.emergence;
  return {
    ...merged,
    tickSeconds: tickSeconds ?? merged.tickSeconds,
    liveSensorTrust: emergence?.metrics.sensor_trust,
    liveCommsCongestion: emergence?.metrics.comms_congestion,
    liveMissionTempo: emergence?.metrics.mission_tempo_ratio,
    emergenceSummary: emergence?.detected ? emergence.summary : undefined,
  };
}
