import InspectorPanel from "./InspectorPanel";
import { RHandle, RPanel, VGroup } from "./layout/ResizableLayout";
import SelectedMomentPanel from "./replay/SelectedMomentPanel";
import type { SimEvent } from "../types";
import type { TreeSelection } from "../types/selection";
import type { TickRange } from "../utils/timelineGroupSelection";

type InspectorRailProps = {
  selection: TreeSelection;
  onSelect?: (selection: TreeSelection) => void;
  timelineRange?: TickRange | null;
  onOpenEventCausal?: (event: SimEvent) => void;
  onOpenMomentCausal?: () => void;
};

export default function InspectorRail({
  selection,
  onSelect,
  timelineRange = null,
  onOpenEventCausal,
  onOpenMomentCausal,
}: InspectorRailProps) {
  return (
    <VGroup id="darla-inspector-rail-v" autoSaveId="darla-inspector-rail-v" className="h-full min-h-0">
      <RPanel defaultSize={40} minSize={22} maxSize={55}>
        <SelectedMomentPanel timelineRange={timelineRange} onOpenGroupCausal={onOpenMomentCausal} />
      </RPanel>
      <RHandle />
      <RPanel defaultSize={60} minSize={30}>
        <InspectorPanel
          selection={selection}
          onSelect={onSelect}
          onOpenEventCausal={onOpenEventCausal}
        />
      </RPanel>
    </VGroup>
  );
}
