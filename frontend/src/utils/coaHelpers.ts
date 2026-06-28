import type { CourseOfAction, DashboardData } from "../types";

export function formatCoaAction(action: string): string {
  return action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatCausalLabel(label: string): string {
  return formatCoaAction(label.replace(/\./g, "").trim());
}

export function coaScoreTone(score: number): "good" | "warn" | "bad" {
  if (score >= 0.65) return "good";
  if (score >= 0.45) return "warn";
  return "bad";
}

export function coaScoreClass(tone: "good" | "warn" | "bad"): string {
  switch (tone) {
    case "good":
      return "text-emerald-400";
    case "warn":
      return "text-amber-400";
    default:
      return "text-red-400";
  }
}

/** Mirrors sim-stream `recommendationsAtTick` in sim-stream/main.cpp */
export function coasAtTick(coaLog: CourseOfAction[], tick: number): CourseOfAction[] {
  let latestReview = 0;
  for (const coa of coaLog) {
    if (coa.proposed_tick <= tick && coa.proposed_tick >= latestReview) {
      latestReview = coa.proposed_tick;
    }
  }
  if (latestReview === 0) return [];

  const ranked = coaLog.filter(
    (coa) =>
      coa.proposed_tick === latestReview &&
      coa.status !== "superseded" &&
      coa.status !== "rejected",
  );

  return ranked.sort((a, b) => {
    if (a.action === "hold_current_coa") return 1;
    if (b.action === "hold_current_coa") return -1;
    return b.score - a.score;
  });
}

export function rankCoas(
  recommendations: CourseOfAction[],
  coaLog: CourseOfAction[],
  tick?: number,
): CourseOfAction[] {
  const tickScoped = tick != null && recommendations.length === 0 ? coasAtTick(coaLog, tick) : [];
  const source = recommendations.length > 0 ? recommendations : tickScoped.length > 0 ? tickScoped : coaLog;

  const byId = new Map<number, CourseOfAction>();
  for (const coa of source) {
    const existing = byId.get(coa.id);
    if (!existing || coa.score > existing.score) {
      byId.set(coa.id, coa);
    }
  }
  return [...byId.values()].sort((a, b) => {
    if (a.action === "hold_current_coa") return 1;
    if (b.action === "hold_current_coa") return -1;
    return b.score - a.score;
  });
}

export function parseCausalChain(coa: CourseOfAction): string[] {
  if (coa.evidence?.dominant_path?.length) {
    return coa.evidence.dominant_path
      .filter((node) => node.type !== "action" && node.type !== "outcome")
      .map((node) => formatCausalLabel(node.label));
  }

  const rationale = coa.rationale;
  const pathMarker = ", path ";
  const pathStart = rationale.indexOf(pathMarker);
  if (pathStart === -1) return [];
  const pathEnd = rationale.indexOf(" for action ");
  const pathSegment = rationale.slice(
    pathStart + pathMarker.length,
    pathEnd === -1 ? undefined : pathEnd,
  );
  return pathSegment
    .split("->")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(formatCausalLabel);
}

export function coaApprovalKey(coa: CourseOfAction): string {
  return `${coa.action}@${coa.scheduled_at_tick}`;
}

export function coaRationaleSummary(coa: CourseOfAction): string {
  const chain = parseCausalChain(coa);
  if (chain.length >= 2) {
    return `Recommended because ${chain[0]} leads to ${chain[chain.length - 1]} and ${formatCoaAction(coa.action)} breaks that branch with projected gain ${coa.expected_mission_gain.toFixed(3)}.`;
  }
  if (!coa.rationale.includes("->")) {
    return coa.rationale;
  }
  return `Recommended because it improves projected mission outcome (score ${coa.score.toFixed(3)}) after cost and risk penalties.`;
}

export function coaSummary(coa: CourseOfAction, rank: number): string {
  if (rank === 1 && coa.status === "recommended") {
    return `Highest-ranked at T+${coa.proposed_tick}: gain ${coa.expected_mission_gain.toFixed(3)}, risk ${coa.risk.toFixed(3)}, cost ${coa.cost}.`;
  }
  if (coa.expected_mission_gain <= 0) {
    return "Baseline branch for comparison. Does not recover mission delta.";
  }
  if (coa.risk >= 0.1) {
    return `Mission gain ${coa.expected_mission_gain.toFixed(3)} with elevated risk ${coa.risk.toFixed(3)}.`;
  }
  return `Viable alternative: gain ${coa.expected_mission_gain.toFixed(3)}, risk ${coa.risk.toFixed(3)}.`;
}

export type CausalStripNode = {
  label: string;
  subtitle: string;
  kind?: "action" | "outcome";
};

export function buildCausalStripNodes(coa: CourseOfAction): CausalStripNode[] {
  if (coa.evidence?.dominant_path?.length) {
    return coa.evidence.dominant_path.map((node) => ({
      label: formatCausalLabel(node.label),
      subtitle:
        node.type === "observation"
          ? "Observed"
          : node.type === "inference"
            ? "Inferred"
            : node.type === "effect"
              ? "Effect"
              : node.type === "action"
                ? "Mitigation COA"
                : `Projected gain ${coa.expected_mission_gain.toFixed(3)}`,
      kind:
        node.type === "action"
          ? ("action" as const)
          : node.type === "outcome"
            ? ("outcome" as const)
            : undefined,
    }));
  }

  const chain = parseCausalChain(coa);
  const actionLabel = formatCoaAction(coa.action);

  if (chain.length >= 2) {
    const prelude = chain.map((label, index) => ({
      label,
      subtitle:
        index === 0 ? "Observed" : index === chain.length - 1 ? "Effect" : "Inferred",
    }));
    return [
      ...prelude,
      { label: actionLabel, subtitle: "Mitigation COA", kind: "action" as const },
      {
        label: "Mission recovery",
        subtitle: `Projected gain ${coa.expected_mission_gain.toFixed(3)}`,
        kind: "outcome" as const,
      },
    ];
  }

  return [
    { label: "Operational degradation", subtitle: "Observed branch" },
    { label: "Mission impact", subtitle: "Without intervention" },
    { label: actionLabel, subtitle: "Mitigation COA", kind: "action" as const },
    {
      label: "Mission recovery",
      subtitle: `Projected gain ${coa.expected_mission_gain.toFixed(3)}`,
      kind: "outcome" as const,
    },
  ];
}

export type EvidenceStep = { title: string; body: string };

export function buildEvidenceSteps(
  coa: CourseOfAction,
  dashboard: DashboardData | null,
): EvidenceStep[] {
  const chain = parseCausalChain(coa);
  const rawParts = coa.evidence?.dominant_path?.length
    ? coa.evidence.dominant_path.map((node) => node.label)
    : coa.rationale.includes("->")
      ? coa.rationale.split("->").map((part) => part.trim()).filter(Boolean)
      : [];

  const observed =
    chain[0] ??
    (rawParts[0] ? formatCausalLabel(rawParts[0]) : `Operational degradation affecting ${coa.target}.`);

  const inferred =
    chain.length >= 3
      ? chain.slice(1, -1).join(" → ")
      : chain.length === 2
        ? chain[1]
        : `Propagates with causal confidence ${coa.causal_confidence.toFixed(3)} before T+${coa.scheduled_at_tick}.`;

  const ranked = `${formatCoaAction(coa.action)} is ${coa.status} with score ${coa.score.toFixed(3)} (gain ${coa.expected_mission_gain.toFixed(3)}, risk ${coa.risk.toFixed(3)}, cost ${coa.cost}).`;

  let actionable = `Executable on ${coa.target} at T+${coa.scheduled_at_tick}. Approval key: ${coaApprovalKey(coa)}.`;
  const search = dashboard?.intervention_search;
  if (search) {
    const candidates = [search.lowest_cost_effective, search.best_effective];
    const match = candidates.find((item) => item.options.includes(coa.action));
    if (match) {
      actionable += ` Intervention search match (${match.options}): mission score ${match.mission_score.toFixed(3)}, effect ${match.estimated_effect.toFixed(3)}.`;
    }
  }

  return [
    { title: "Observed", body: observed },
    { title: "Inferred", body: inferred },
    { title: "Ranked", body: ranked },
    { title: "Actionable", body: actionable },
  ];
}

export function findCoaById(
  coaLog: CourseOfAction[],
  id: number,
): CourseOfAction | undefined {
  return coaLog.find((coa) => coa.id === id);
}
