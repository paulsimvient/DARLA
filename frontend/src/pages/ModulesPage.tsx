import { useCallback, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { HGroup, RHandle, RPanel } from "../components/layout/ResizableLayout";
import ModuleCanvas from "../components/ModuleCanvas";
import ModuleInspector from "../components/ModuleInspector";
import ModuleLibrary from "../components/ModuleLibrary";
import type { ModuleCategory } from "../types/moduleCanvas";
import { SCENARIOS, useSimulation } from "../context/SimulationContext";
import { buildSimModulesFromEntities } from "../utils/simModulesFromEntities";

export default function ModulesPage() {
  const { scenario, entities, relationships, dashboard } = useSimulation();
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

  const handleConnectionChange = useCallback(
    (sourceId: string, targetId: string, action: "add" | "remove") => {
      setConnectionOverrides((prev) => {
        const base =
          prev[sourceId] ?? baseModules.find((mod) => mod.id === sourceId)?.connections ?? [];
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

  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 flex-col gap-2 bg-darla-bg p-4">
        <div className="rounded-lg border border-darla-border bg-darla-panel px-3 py-2 text-[11px] text-darla-text-muted">
          Live sim modules from <span className="text-darla-text">{scenarioMeta.label}</span> export —{" "}
          {modules.length} entities, {relationships.length} relationships. Drag nodes to rearrange; drag from
          an output port (right) to an input port (left) to connect; select a link and press Backspace to
          disconnect.
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
              selectedId={selectedModule?.id ?? null}
              onSelectModule={setSelectedId}
              onRemoveFromCanvas={() => {}}
              onConnectionChange={handleConnectionChange}
            />
          </RPanel>
          <RHandle />
          <RPanel defaultSize={28} minSize={18} maxSize={40}>
            <ModuleInspector
              module={selectedModule}
              readOnly
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
