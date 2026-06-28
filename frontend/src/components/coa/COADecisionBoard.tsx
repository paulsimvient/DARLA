import { useEffect, useState } from "react";
import BranchCompareStrip, { metricsFromFrame } from "./BranchCompareStrip";
import BranchComparisonPanel from "./BranchComparisonPanel";
import COADecisionCenter from "./COADecisionCenter";
import CommandStatusBanner from "./CommandStatusBanner";
import COADecisionDetail from "./COADecisionDetail";
import COARankingPanel from "./COARankingPanel";
import { HGroup, VGroup, RHandle, RPanel } from "../layout/ResizableLayout";
import { useSimulation } from "../../context/SimulationContext";
import type { CourseOfAction } from "../../types";

type COADecisionBoardProps = {
  onOpenCausalTrace?: (coa: CourseOfAction) => void;
};

export default function COADecisionBoard({ onOpenCausalTrace }: COADecisionBoardProps) {
  const {
    coasAtCurrentTick,
    displayEntities,
    relationships,
    currentTick,
    dashboard,
    currentFrame,
    displayCurrentFrame,
    approvedCoaIds,
    runIdentity,
    displayRunIdentity,
    branchResults,
    commandAcks,
    authorizationMode,
    status,
    replayView,
    compareBranch,
    activeBranch,
    compareBranchFrame,
    openBranchReplay,
    returnToBaseline,
    startBranchCompare,
    stopBranchCompare,
  } = useSimulation();

  const coas = coasAtCurrentTick;

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = coas.find((coa) => coa.id === selectedId) ?? coas[0] ?? null;

  useEffect(() => {
    if (coas.length === 0) return;
    if (selectedId == null || !coas.some((coa) => coa.id === selectedId)) {
      setSelectedId(coas[0].id);
    }
  }, [coas, selectedId]);

  const handleSelect = (coa: CourseOfAction) => {
    setSelectedId(coa.id);
  };

  return (
    <VGroup id="darla-coa-root-v" autoSaveId="darla-coa-root-v" className="min-h-0 flex-1 gap-0">
      <RPanel defaultSize={72} minSize={45}>
        <HGroup id="darla-coa-h" autoSaveId="darla-coa-h" className="min-h-0 flex-1 p-3">
          <RPanel defaultSize={24} minSize={16} maxSize={38}>
            <COARankingPanel coas={coas} selectedId={selected?.id ?? null} onSelect={handleSelect} />
          </RPanel>
          <RHandle />
          <RPanel defaultSize={46} minSize={28}>
            <div className="flex h-full min-h-0 flex-col gap-2">
              <CommandStatusBanner acks={commandAcks} />
              <div className="min-h-0 flex-1">
                <COADecisionCenter
                  coa={selected}
                  entities={displayEntities}
                  relationships={relationships}
                  currentTick={currentTick}
                  status={status}
                  approvals={approvedCoaIds}
                  authorizationMode={authorizationMode}
                  currentFrame={displayCurrentFrame}
                  onOpenCausalTrace={onOpenCausalTrace}
                />
              </div>
            </div>
          </RPanel>
          <RHandle />
          <RPanel defaultSize={30} minSize={18} maxSize={42}>
            <COADecisionDetail
              coa={selected}
              dashboard={dashboard}
              runId={displayRunIdentity?.run_id ?? runIdentity?.run_id}
              onOpenCausalTrace={onOpenCausalTrace}
            />
          </RPanel>
        </HGroup>
      </RPanel>
      <RHandle />
      <RPanel defaultSize={28} minSize={16} maxSize={40}>
        <div className="flex flex-col gap-2 p-3 pt-0">
          {replayView === "compare" && compareBranch ? (
            <BranchCompareStrip
              tick={currentTick}
              baselineLabel={runIdentity?.branch_id ?? "baseline"}
              branchLabel={compareBranch.branch_id}
              baselineMetrics={metricsFromFrame(currentFrame)}
              branchMetrics={metricsFromFrame(compareBranchFrame)}
              branchResult={compareBranch}
            />
          ) : null}
          <BranchComparisonPanel
            runIdentity={runIdentity}
            baselineMetrics={currentFrame?.metrics ?? dashboard?.online_metrics ?? null}
            branchResults={branchResults}
            selectedCoaId={selected?.id ?? null}
            replayView={replayView}
            compareBranch={compareBranch}
            activeBranch={activeBranch}
            onOpenBranchReplay={openBranchReplay}
            onStartCompare={startBranchCompare}
            onReturnToBaseline={returnToBaseline}
            onStopCompare={stopBranchCompare}
          />
        </div>
      </RPanel>
    </VGroup>
  );
}
