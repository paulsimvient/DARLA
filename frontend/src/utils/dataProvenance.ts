import type { DashboardData, RunIdentity } from "../types";

export type DataProvenanceSnapshot = {
  scenarioId: string;
  seed: string;
  replayHash: string;
  dataMode: string;
  mapData: string;
  weather: string;
  ais: string;
  fmu: string;
  pythonScript: string;
  vvaStatus: string;
};

export type ScenarioProvenanceFile = {
  scenario_id?: string;
  data_mode?: string;
  verification?: string;
  sources?: {
    ais?: { provider?: string; path?: string; captured_at?: string };
    weather?: { provider?: string; path?: string; captured_at?: string };
    map?: { provider?: string; path?: string };
  };
  regression?: {
    seed?: number;
    replay_hash?: string;
    detection_time?: number;
  };
};

function summarizeFmu(dashboard: DashboardData | null): string {
  const runtime = dashboard?.fmu_runtime ?? [];
  if (runtime.length === 0) return "not configured";
  const modes = [...new Set(runtime.map((entry) => entry.load_mode).filter(Boolean))];
  return modes.length > 0 ? modes.join(", ") : "not configured";
}

function summarizePythonScripts(dashboard: DashboardData | null): string {
  const scripts = dashboard?.python_scripts ?? [];
  if (scripts.length === 0) return "not declared";
  if (scripts.every((script) => script.loaded)) {
    return `${scripts.length} loaded`;
  }
  return scripts.map((script) => `${script.object_id}: ${script.last_reload_status}`).join("; ");
}

function summarizeWeather(
  dashboard: DashboardData | null,
  provenanceFile: ScenarioProvenanceFile | null,
): string {
  const env = dashboard?.environment;
  if (env?.weather_source && env.weather_source !== "synthetic") {
    const provider = provenanceFile?.sources?.weather?.provider ?? "Open-Meteo";
    return `${provider} · ${env.weather_summary || "snapshot loaded"}`;
  }
  if (env?.weather_summary) return env.weather_summary;
  return "not connected";
}

function summarizeAis(
  dashboard: DashboardData | null,
  provenanceFile: ScenarioProvenanceFile | null,
): string {
  const openData = dashboard?.open_data;
  if (openData?.ais_track_count && openData.ais_track_count > 0) {
    const provider = provenanceFile?.sources?.ais?.provider ?? "AIS snapshot";
    return `${openData.ais_track_count} tracks · ${provider}`;
  }
  if (openData?.ais_tracks_path) {
    return `configured (${openData.ais_tracks_path})`;
  }
  return "not connected";
}

function summarizeMap(provenanceFile: ScenarioProvenanceFile | null): string {
  const mapSource = provenanceFile?.sources?.map?.provider;
  if (mapSource) return `MapLibre · ${mapSource}`;
  return "MapLibre · Esri imagery · OSM labels";
}

export function buildDataProvenance(
  dashboard: DashboardData | null,
  runIdentity: RunIdentity | null,
  scenarioPath: string,
  provenanceFile: ScenarioProvenanceFile | null = null,
): DataProvenanceSnapshot {
  const plantedScore = dashboard?.planted_truth.recovery_score;
  const verification = provenanceFile?.verification ?? "internal_only";
  const vvaStatus = dashboard
    ? plantedScore != null
      ? `${verification.replace(/_/g, " ")} · planted truth ${(plantedScore * 100).toFixed(0)}%`
      : verification.replace(/_/g, " ")
    : "not run";

  const dataMode =
    dashboard?.open_data?.data_mode ??
    provenanceFile?.data_mode?.replace(/_/g, " ") ??
    "Deterministic synthetic micro-world";

  return {
    scenarioId: dashboard?.scenario_id ?? scenarioPath.split("/").pop()?.replace(".yaml", "") ?? scenarioPath,
    seed: String(dashboard?.seed ?? runIdentity?.seed ?? "—"),
    replayHash: dashboard?.replay_hash ?? runIdentity?.replay_hash ?? "—",
    dataMode: dataMode.replace(/_/g, " "),
    mapData: summarizeMap(provenanceFile),
    weather: summarizeWeather(dashboard, provenanceFile),
    ais: summarizeAis(dashboard, provenanceFile),
    fmu: summarizeFmu(dashboard),
    pythonScript: summarizePythonScripts(dashboard),
    vvaStatus,
  };
}
