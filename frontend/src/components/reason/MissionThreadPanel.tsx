import Badge from "../Badge";

type MissionThreadPanelProps = {
  dashboard: Record<string, any> | null | undefined;
  events: Array<Record<string, any>>;
  currentTick: number;
  selectedCoa?: string | null;
  confidence?: number;
};

function formatEvent(event: Record<string, any>, fallbackIndex: number) {
  const tick = event.tick ?? event.t ?? event.time ?? fallbackIndex;
  const label = event.title ?? event.message ?? event.type ?? event.event_type ?? "runtime event";
  return { tick, label: String(label) };
}

function pct(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

export default function MissionThreadPanel({
  dashboard,
  events,
  currentTick,
  selectedCoa,
  confidence,
}: MissionThreadPanelProps) {
  const selected =
    selectedCoa ??
    dashboard?.evidence_package?.selected_coa ??
    dashboard?.decision_layer?.selected_coa ??
    dashboard?.recommendation?.action_id ??
    "hold";

  const conf =
    confidence ??
    dashboard?.evidence_package?.confidence_score ??
    dashboard?.decision_layer?.confidence_score ??
    dashboard?.confidence_score;

  const recentEvents = events.slice(-5).map(formatEvent);
  const causalCount =
    dashboard?.evidence_package?.causal_assumptions?.length ??
    dashboard?.temporal_causal_graph?.length ??
    dashboard?.claims?.length ??
    0;

  const branchCount =
    dashboard?.evidence_package?.counterfactual_results?.length ??
    dashboard?.branch_results?.length ??
    dashboard?.branchComparisons?.length ??
    0;

  const steps = [
    {
      title: "Mission observed",
      body: recentEvents[0]?.label ?? "No observation selected yet.",
      tick: recentEvents[0]?.tick ?? currentTick,
      tone: "blue" as const,
    },
    {
      title: "Belief updated",
      body: causalCount
        ? `${causalCount} causal/evidence relationships active`
        : "Belief state is inferred from runtime events until formal belief deltas are exported.",
      tick: currentTick,
      tone: causalCount ? ("green" as const) : ("orange" as const),
    },
    {
      title: "Counterfactual tested",
      body: branchCount
        ? `${branchCount} branch/counterfactual runs available`
        : "No branch evidence exported for this moment.",
      tick: currentTick,
      tone: branchCount ? ("green" as const) : ("orange" as const),
    },
    {
      title: "Decision candidate",
      body: selected,
      tick: currentTick,
      tone: selected === "hold" ? ("orange" as const) : ("green" as const),
    },
  ];

  return (
    <section className="rounded-xl border border-darla-border bg-darla-panel p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-darla-text-muted">
            Mission Thread
          </div>
          <h3 className="mt-1 text-sm font-semibold text-darla-text">
            What happened, why it matters, and what changed
          </h3>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge tone={selected === "hold" ? "orange" : "green"}>{selected}</Badge>
          <Badge tone="neutral">confidence {pct(conf)}</Badge>
          <Badge tone="blue">T+{currentTick}</Badge>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <article key={step.title} className="rounded-lg border border-darla-border bg-darla-bg p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-darla-panel-elevated text-[11px] font-semibold text-darla-blue">
                {index + 1}
              </span>
              <Badge tone={step.tone}>{step.title}</Badge>
            </div>
            <p className="mt-2 min-h-[42px] text-[11px] leading-relaxed text-darla-text-secondary">{step.body}</p>
            <div className="mt-2 text-[10px] text-darla-text-muted">T+{step.tick}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
