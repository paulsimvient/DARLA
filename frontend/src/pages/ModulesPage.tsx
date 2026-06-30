import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { HGroup, RHandle, RPanel } from "../components/layout/ResizableLayout";
import ModuleCanvas from "../components/ModuleCanvas";
import ModuleInspector from "../components/ModuleInspector";
import ModuleLibrary from "../components/ModuleLibrary";
import RunSummaryCard from "../components/modules/RunSummaryCard";
import type { ModuleCategory } from "../types/moduleCanvas";
import { SCENARIOS, useSimulation } from "../context/SimulationContext";
import { buildRunModuleSummary } from "../utils/moduleGraphRealism";
import { buildSimModulesFromEntities } from "../utils/simModulesFromEntities";

export default function ModulesPage() {
  const {
    scenario,
    entities,
    relationships,
    dashboard,
    currentTick,
    activeCoa,
    coasAtCurrentTick,
    simulateWhatIf,
  } = useSimulation();
  const navigate = useNavigate();
  const scenarioMeta = SCENARIOS.find((s) => s.id === scenario) ?? SCENARIOS[0];

  const baseModules = useMemo(
    () => buildSimModulesFromEntities(entities, relationships, dashboard),
    [entities, relationships, dashboard],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<ModuleCategory | null>(null);
  const [connectionOverrides, setConnectionOverrides] = useState<Record<string, string[]>>({});

  const modules = useMemo(
    () =>
      baseModules.map((mod) => ({
        ...mod,
        connections: connectionOverrides[mod.id] ?? mod.connections,
      })),
    [baseModules, connectionOverrides],
  );

  const runSummary = useMemo(
    () => buildRunModuleSummary(dashboard, dashboard?.coa_log ?? coasAtCurrentTick),
    [coasAtCurrentTick, dashboard],
  );

  const handleConnectionChange = useCallback(
    (sourceId: string, targetId: string, action: "add" | "remove") => {
      setConnectionOverrides((prev) => {
        const base = prev[sourceId] ?? baseModules.find((mod) => mod.id === sourceId)?.connections ?? [];
        const next =
          action === "add"
            ? base.includes(targetId)
              ? base
              : [...base, targetId]
            : base.filter((id) => id !== targetId);
        return { ...prev, [sourceId]: next };
      });
    },
    [baseModules],
  );

  const selectedModule = modules.find((m) => m.id === (selectedId ?? modules[0]?.id)) ?? null;

  const handleOpenRealism = useCallback(() => {
    navigate("/realism");
  }, [navigate]);

  const handleRunCounterfactual = useCallback(
    (moduleId: string) => {
      const candidate =
        (dashboard?.coa_log ?? []).find((coa) => coa.target === moduleId) ?? activeCoa ?? coasAtCurrentTick[0];
      if (candidate) {
        void simulateWhatIf(candidate, currentTick);
      }
      navigate("/realism");
    },
    [activeCoa, coasAtCurrentTick, currentTick, dashboard, navigate, simulateWhatIf],
  );

  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 flex-col gap-2 bg-darla-bg p-4">
        <div className="grid gap-2 xl:grid-cols-[1fr_420px]">
          <div className="rounded-lg border border-darla-border bg-darla-panel px-3 py-2 text-[11px] text-darla-text-muted">
            <span className="text-darla-text">Module Graph:</span> live sim modules from{" "}
            <span className="text-darla-text">{scenarioMeta.label}</span> export — {modules.length} entities,
            {" "}{relationships.length} typed relationships. Nodes are time-indexed to replay tick T+{currentTick}; edge labels show model semantics.
          </div>
          <RunSummaryCard summary={runSummary} replayHash={dashboard?.replay_hash} />
        </div>
        <HGroup id="darla-modules-h" autoSaveId="darla-modules-h" className="min-h-0 flex-1">
          <RPanel defaultSize={22} minSize={14} maxSize={35}>
            <ModuleLibrary
              modules={modules}
              selectedCategory={categoryFilter}
              selectedId={selectedModule?.id ?? null}
              onSelectCategory={setCategoryFilter}
              onSelectModule={setSelectedId}
              onAddToCanvas={() => {}}
              onCreateModule={() => {}}
              readOnly
            />
          </RPanel>
          <RHandle />
          <RPanel defaultSize={50} minSize={30}>
            <ModuleCanvas
              modules={modules}
              entities={entities}
              relationships={relationships}
              dashboard={dashboard}
              currentTick={currentTick}
              selectedId={selectedModule?.id ?? null}
              onSelectModule={setSelectedId}
              onRemoveFromCanvas={() => {}}
              onConnectionChange={handleConnectionChange}
            />
          </RPanel>
          <RHandle />
          <RPanel defaultSize={28} minSize={18} maxSize={42}>
            <ModuleInspector
              module={selectedModule}
              entities={entities}
              relationships={relationships}
              dashboard={dashboard}
              currentTick={currentTick}
              readOnly
              onOpenRealism={handleOpenRealism}
              onRunCounterfactual={handleRunCounterfactual}
              onChange={() => {}}
              onAddInput={() => {}}
              onAddOutput={() => {}}
              onRemoveInput={() => {}}
              onRemoveOutput={() => {}}
              onAddTag={() => {}}
              onRemoveTag={() => {}}
              onSave={() => {}}
              onValidate={() => {}}
            />
          </RPanel>
        </HGroup>
      </div>
    </AppShell>
  );
}
