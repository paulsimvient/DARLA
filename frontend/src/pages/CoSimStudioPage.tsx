import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import CoSimLogsPanel from "../components/cosim/CoSimLogsPanel";
import ExecutionGraphPanel from "../components/cosim/ExecutionGraphPanel";
import FMUInspectorPanel from "../components/cosim/FMUInspectorPanel";
import ModelLibraryPanel from "../components/cosim/ModelLibraryPanel";
import ScriptEditorPanel from "../components/cosim/ScriptEditorPanel";
import { HGroup, RHandle, RPanel, VGroup } from "../components/layout/ResizableLayout";
import { useSimulation } from "../context/SimulationContext";
import {
  buildCoSimLogsFromDashboard,
  buildCoSimModelsFromDashboard,
  buildExecutionGraphFromDashboard,
  buildScriptTabsFromDashboard,
  defaultSelectedFmuId,
} from "../utils/coSimFromDashboard";

export default function CoSimStudioPage() {
  const { dashboard, currentTick, status } = useSimulation();
  const models = useMemo(() => buildCoSimModelsFromDashboard(dashboard), [dashboard]);
  const scriptTabs = useMemo(() => buildScriptTabsFromDashboard(dashboard), [dashboard]);
  const executionGraph = useMemo(() => buildExecutionGraphFromDashboard(dashboard), [dashboard]);
  const logs = useMemo(
    () => buildCoSimLogsFromDashboard(dashboard, currentTick),
    [dashboard, currentTick],
  );
  const defaultId = defaultSelectedFmuId(dashboard);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(defaultId);

  useEffect(() => {
    setSelectedModelId(defaultSelectedFmuId(dashboard));
  }, [dashboard?.scenario_id, dashboard?.seed]);

  const effectiveSelectedId = selectedModelId ?? defaultId;
  const selectedModel = models.find((model) => model.id === effectiveSelectedId) ?? models[0] ?? null;

  return (
    <AppShell>
      <VGroup id="darla-cosim-v" autoSaveId="darla-cosim-v" className="min-h-0 flex-1 gap-0 bg-darla-bg p-4">
        <RPanel defaultSize={8} minSize={5} maxSize={14}>
          <p className="text-[12px] text-darla-text-muted">
            Live co-simulation bindings and script components from scenario YAML — {models.length} model
            {models.length === 1 ? "" : "s"} configured
            {status === "loading" ? " (loading…)" : ""}.
          </p>
        </RPanel>
        <RHandle />
        <RPanel defaultSize={58} minSize={35}>
          <HGroup id="darla-cosim-top-h" autoSaveId="darla-cosim-top-h" className="h-full">
            <RPanel defaultSize={22} minSize={14} maxSize={35}>
              <ModelLibraryPanel
                models={models}
                selectedId={effectiveSelectedId}
                onSelectModel={setSelectedModelId}
              />
            </RPanel>
            <RHandle />
            <RPanel defaultSize={48} minSize={30}>
              <ScriptEditorPanel tabs={scriptTabs} />
            </RPanel>
            <RHandle />
            <RPanel defaultSize={30} minSize={18} maxSize={42}>
              <FMUInspectorPanel model={selectedModel} />
            </RPanel>
          </HGroup>
        </RPanel>
        <RHandle />
        <RPanel defaultSize={34} minSize={20}>
          <VGroup id="darla-cosim-bottom-v" autoSaveId="darla-cosim-bottom-v" className="h-full gap-0">
            <RPanel defaultSize={62} minSize={35}>
              <ExecutionGraphPanel nodes={executionGraph.nodes} edges={executionGraph.edges} />
            </RPanel>
            <RHandle />
            <RPanel defaultSize={38} minSize={20}>
              <CoSimLogsPanel logs={logs} />
            </RPanel>
          </VGroup>
        </RPanel>
      </VGroup>
    </AppShell>
  );
}
