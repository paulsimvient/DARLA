import { useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  Crosshair,
  GitBranch,
  Globe,
  Radio,
  Target,
  Zap,
} from "lucide-react";
import { SCENARIOS, useSimulation } from "../context/SimulationContext";
import type { TreeSelection } from "../types/selection";
import { selectionKey } from "../types/selection";

type ScenarioTreeProps = {
  selection: TreeSelection;
  onSelect: (selection: TreeSelection) => void;
};

export default function ScenarioTree({ selection, onSelect }: ScenarioTreeProps) {
  const { scenario, entities, relationships, events, coasAtCurrentTick } = useSimulation();
  const scenarioMeta = SCENARIOS.find((s) => s.id === scenario) ?? SCENARIOS[0];

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    root: true,
    forces: true,
    blue: true,
    red: true,
    relationships: false,
    events: false,
    coas: false,
  });

  const blueEntities = entities.filter((e) => e.side === "Blue");
  const redEntities = entities.filter((e) => e.side === "Red");
  const otherEntities = entities.filter((e) => !["Blue", "Red"].includes(e.side));

  const coas = coasAtCurrentTick;

  const recentEvents = useMemo(
    () => [...events].sort((a, b) => b.tick - a.tick || b.event_id - a.event_id).slice(0, 16),
    [events],
  );

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const activeKey = selectionKey(selection);

  return (
    <aside className="darla-scroll flex h-full w-full flex-col overflow-y-auto border-r border-darla-border bg-darla-surface">
      <header className="border-b border-darla-border px-3 py-2.5">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-darla-text-muted">
          Scenario Explorer
        </h2>
        <p className="mt-0.5 truncate text-xs text-darla-text-secondary">{scenarioMeta.label}</p>
      </header>

      <nav className="p-2 text-[12px]">
        <TreeBranch
          label={scenarioMeta.label}
          icon={<Globe size={14} />}
          expanded={expanded.root}
          onToggle={() => toggle("root")}
          active={activeKey === "scenario"}
          onSelect={() => onSelect({ type: "scenario" })}
          depth={0}
        >
          <TreeLeaf
            label="Environment"
            icon={<Radio size={13} />}
            active={activeKey === "environment"}
            onSelect={() => onSelect({ type: "environment" })}
            depth={1}
          />
          <TreeLeaf
            label="Mission"
            icon={<Target size={13} />}
            active={activeKey === "mission"}
            onSelect={() => onSelect({ type: "mission" })}
            depth={1}
          />

          <TreeBranch
            label={`Forces (${entities.length})`}
            icon={<Crosshair size={14} />}
            expanded={expanded.forces}
            onToggle={() => toggle("forces")}
            active={false}
            onSelect={() => toggle("forces")}
            depth={1}
          >
            <TreeBranch
              label={`Blue (${blueEntities.length})`}
              expanded={expanded.blue}
              onToggle={() => toggle("blue")}
              active={activeKey === "force:Blue"}
              onSelect={() => onSelect({ type: "force", side: "Blue" })}
              depth={2}
              tone="blue"
            >
              {blueEntities.map((entity) => (
                <TreeLeaf
                  key={entity.id}
                  label={entity.id}
                  sublabel={entity.kind}
                  active={activeKey === `entity:${entity.id}`}
                  onSelect={() => onSelect({ type: "entity", id: entity.id })}
                  depth={3}
                  tone="blue"
                />
              ))}
            </TreeBranch>

            <TreeBranch
              label={`Red (${redEntities.length})`}
              expanded={expanded.red}
              onToggle={() => toggle("red")}
              active={activeKey === "force:Red"}
              onSelect={() => onSelect({ type: "force", side: "Red" })}
              depth={2}
              tone="red"
            >
              {redEntities.map((entity) => (
                <TreeLeaf
                  key={entity.id}
                  label={entity.id}
                  sublabel={entity.kind}
                  active={activeKey === `entity:${entity.id}`}
                  onSelect={() => onSelect({ type: "entity", id: entity.id })}
                  depth={3}
                  tone="red"
                />
              ))}
            </TreeBranch>

            {otherEntities.length > 0 ? (
              <TreeBranch
                label={`Other (${otherEntities.length})`}
                expanded={expanded.other ?? false}
                onToggle={() => toggle("other")}
                active={activeKey === "force:Other"}
                onSelect={() => onSelect({ type: "force", side: "Other" })}
                depth={2}
              >
                {otherEntities.map((entity) => (
                  <TreeLeaf
                    key={entity.id}
                    label={entity.id}
                    sublabel={entity.kind}
                    active={activeKey === `entity:${entity.id}`}
                    onSelect={() => onSelect({ type: "entity", id: entity.id })}
                    depth={3}
                  />
                ))}
              </TreeBranch>
            ) : null}
          </TreeBranch>

          <TreeBranch
            label={`Relationships (${relationships.length})`}
            icon={<GitBranch size={14} />}
            expanded={expanded.relationships}
            onToggle={() => toggle("relationships")}
            active={activeKey === "relationships"}
            onSelect={() => onSelect({ type: "relationships" })}
            depth={1}
          >
            {relationships.map((edge, index) => (
              <TreeLeaf
                key={`${edge.type}-${edge.source}-${edge.target}-${index}`}
                label={edge.type}
                sublabel={`${edge.source} → ${edge.target}`}
                active={activeKey === `relationship:${index}`}
                onSelect={() => onSelect({ type: "relationship", index })}
                depth={2}
              />
            ))}
          </TreeBranch>

          <TreeBranch
            label={`Events (${events.length})`}
            icon={<Zap size={14} />}
            expanded={expanded.events}
            onToggle={() => toggle("events")}
            active={activeKey === "events"}
            onSelect={() => onSelect({ type: "events" })}
            depth={1}
          >
            {recentEvents.map((event) => (
              <TreeLeaf
                key={event.event_id}
                label={event.label || event.type}
                sublabel={`T+${event.tick}`}
                active={activeKey === `event:${event.event_id}`}
                onSelect={() => onSelect({ type: "event", id: event.event_id })}
                depth={2}
              />
            ))}
          </TreeBranch>

          <TreeBranch
            label={`COAs (${coas.length})`}
            icon={<Target size={14} />}
            expanded={expanded.coas}
            onToggle={() => toggle("coas")}
            active={activeKey === "coas"}
            onSelect={() => onSelect({ type: "coas" })}
            depth={1}
          >
            {coas.map((coa) => (
              <TreeLeaf
                key={coa.id}
                label={coa.action}
                sublabel={coa.status}
                active={activeKey === `coa:${coa.id}`}
                onSelect={() => onSelect({ type: "coa", id: coa.id })}
                depth={2}
              />
            ))}
          </TreeBranch>
        </TreeBranch>
      </nav>
    </aside>
  );
}

function TreeBranch({
  label,
  icon,
  expanded,
  onToggle,
  active,
  onSelect,
  depth,
  tone,
  children,
}: {
  label: string;
  icon?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  active: boolean;
  onSelect: () => void;
  depth: number;
  tone?: "blue" | "red";
  children?: ReactNode;
}) {
  return (
    <div>
      <div
        className={`flex w-full items-center gap-1 rounded-md pr-1 transition-colors ${rowTone(active, tone)}`}
        style={{ paddingLeft: depth * 12 + 4 }}
      >
        <button type="button" onClick={onToggle} className="rounded p-0.5 text-darla-text-muted hover:text-darla-text">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left"
        >
          {icon ? <span className="shrink-0 opacity-70">{icon}</span> : null}
          <span className="truncate font-medium">{label}</span>
        </button>
      </div>
      {expanded ? children : null}
    </div>
  );
}

function TreeLeaf({
  label,
  sublabel,
  icon,
  active,
  onSelect,
  depth,
  tone,
}: {
  label: string;
  sublabel?: string;
  icon?: ReactNode;
  active: boolean;
  onSelect: () => void;
  depth: number;
  tone?: "blue" | "red";
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-start gap-2 rounded-md py-1.5 pr-2 text-left transition-colors ${rowTone(active, tone)}`}
      style={{ paddingLeft: depth * 12 + 28 }}
    >
      {icon ? <span className="mt-0.5 shrink-0 opacity-70">{icon}</span> : (
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-darla-text-muted/60" />
      )}
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {sublabel ? (
          <span className="block truncate text-[10px] text-darla-text-muted">{sublabel}</span>
        ) : null}
      </span>
    </button>
  );
}

function rowTone(active: boolean, tone?: "blue" | "red") {
  if (active) {
    return "bg-darla-blue/15 text-darla-text ring-1 ring-inset ring-darla-blue/40";
  }
  if (tone === "blue") {
    return "text-darla-text-secondary hover:bg-blue-500/10 hover:text-darla-text";
  }
  if (tone === "red") {
    return "text-darla-text-secondary hover:bg-red-500/10 hover:text-darla-text";
  }
  return "text-darla-text-secondary hover:bg-darla-panel hover:text-darla-text";
}
