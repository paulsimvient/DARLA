import type { ReactNode } from "react";
import Badge from "./Badge";
import DrilldownButton from "./DrilldownButton";
import MetricRow from "./MetricRow";
import { SCENARIOS, useSimulation } from "../context/SimulationContext";

export default function ScenarioSidebar() {
  const { scenario, events, dashboard, entities, status } = useSimulation();
  const scenarioMeta = SCENARIOS.find((s) => s.id === scenario) ?? SCENARIOS[0];

  const blueCount = entities.filter((e) => e.side === "Blue").length;
  const redCount = entities.filter((e) => e.side === "Red").length;
  const neutralCount = entities.filter((e) => !["Blue", "Red"].includes(e.side)).length;
  const platformCount = entities.filter((e) => e.kind === "Platform").length;
  const sensorCount = entities.filter((e) => e.sensor_range_km).length;

  return (
    <aside className="darla-scroll flex w-64 shrink-0 flex-col overflow-y-auto border-r border-darla-border bg-darla-surface p-4">
      <SidebarBlock title="Scenario">
        <div className="text-sm font-semibold text-darla-text">{scenarioMeta.label}</div>
        <div className="mt-0.5 text-[11px] text-darla-text-muted">{scenarioMeta.subtitle}</div>
        <div className="mt-2 flex items-center gap-2">
          <Badge tone={status === "live" ? "green" : status === "ready" ? "blue" : "neutral"}>
            {status === "live" ? "Live" : status}
          </Badge>
          <span className="font-mono text-[10px] text-darla-text-muted">{events.length} events</span>
        </div>
        <DrilldownButton label="Scenario details" className="mt-2" />
      </SidebarBlock>

      <SidebarBlock title="Forces">
        <MetricRow label="Blue Forces" value={String(blueCount).padStart(2, "0")} padValue />
        <MetricRow label="Red Forces" value={String(redCount).padStart(2, "0")} padValue />
        <MetricRow label="Neutrals" value={String(neutralCount).padStart(2, "0")} padValue />
        <DrilldownButton label="View forces" className="mt-2" />
      </SidebarBlock>

      <SidebarBlock title="Environment">
        <MetricRow label="Weather" value="Partly Cloudy" />
        <MetricRow label="Sea State" value="2 - Moderate" />
        <MetricRow label="Wind" value="12 kts NE" />
        <MetricRow label="Visibility" value="15 km" />
      </SidebarBlock>

      <SidebarBlock title="Assets">
        <MetricRow label="Platforms" value={String(platformCount).padStart(2, "0")} padValue />
        <MetricRow label="Sensors" value={String(sensorCount).padStart(2, "0")} padValue />
        <MetricRow label="Links" value={String(dashboard?.relationships.length ?? 0).padStart(2, "0")} padValue />
        <MetricRow label="Entities" value={String(entities.length).padStart(2, "0")} padValue />
      </SidebarBlock>

      {dashboard ? (
        <SidebarBlock title="Mission">
          <MetricRow
            label="Detection"
            value={
              dashboard.baseline_metrics.target_detected
                ? `T+${dashboard.baseline_metrics.detection_time}`
                : "None"
            }
          />
          <MetricRow
            label="Success score"
            value={dashboard.baseline_metrics.mission_success_score.toFixed(2)}
          />
        </SidebarBlock>
      ) : null}
    </aside>
  );
}

function SidebarBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-darla-border/60 py-4 first:pt-0 last:border-b-0">
      <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-darla-text-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}
