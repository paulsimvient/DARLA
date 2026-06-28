import type { SimulationRun } from "../data/mockScenario";
import type { SimulationStatus } from "../context/SimulationContext";
import type { CourseOfAction, DashboardData } from "../types";

const STORAGE_KEY = "darla-run-history-v1";

export function formatRunDuration(tick: number, tickSeconds: number): string {
  const totalSeconds = tick * tickSeconds;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function riskLabel(risk: number): SimulationRun["risk"] {
  if (risk >= 0.15) return "high";
  if (risk >= 0.08) return "medium";
  return "low";
}

export function buildSimulationRun(input: {
  scenarioLabel: string;
  scenarioPath: string;
  seed: number;
  status: SimulationStatus;
  dashboard: DashboardData | null;
  currentTick: number;
  tickSeconds: number;
  activeCoa: CourseOfAction | null;
  startedAt: string;
  runId?: string;
  branchId?: string;
  parentRunId?: string | null;
}): SimulationRun {
  const metrics = input.dashboard?.online_metrics ?? input.dashboard?.baseline_metrics;
  const coa =
    input.activeCoa?.action ??
    input.dashboard?.coa_log?.find((item) => item.status === "executing" || item.status === "approved")
      ?.action ??
    input.dashboard?.coa_log?.[0]?.action ??
    "policy_auto";

  const runStatus: SimulationRun["status"] =
    input.status === "live" || input.status === "loading"
      ? "running"
      : input.status === "ready"
        ? "complete"
        : input.status === "error"
          ? "failed"
          : "running";

  const topRisk =
    input.activeCoa?.risk ??
    input.dashboard?.coa_log?.find((item) => item.status === "recommended")?.risk ??
    0.1;

  return {
    id: input.runId ?? input.dashboard?.replay_hash?.slice(0, 12) ?? `run-${input.seed}-${input.currentTick}`,
    scenario: input.scenarioLabel,
    coa: coa.replace(/_/g, " "),
    status: runStatus,
    startTime: input.startedAt,
    duration: formatRunDuration(input.currentTick, input.tickSeconds),
    successProbability: Math.round((metrics?.mission_success_score ?? 0) * 100),
    risk: riskLabel(topRisk),
    evidence: input.dashboard?.replay_hash ?? input.scenarioPath,
    scenarioVersion: input.dashboard?.scenario_id ?? input.scenarioPath,
    perturbation:
      input.dashboard?.emergence?.detected ? input.dashboard.emergence.summary : undefined,
    branchId: input.branchId,
    parentRunId: input.parentRunId,
  };
}

export function loadRunHistory(): SimulationRun[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SimulationRun[];
  } catch {
    return [];
  }
}

export function persistCompletedRun(run: SimulationRun): SimulationRun[] {
  const history = loadRunHistory().filter((item) => item.id !== run.id);
  const next = [run, ...history].slice(0, 20);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
