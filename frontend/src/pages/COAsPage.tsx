import AppShell from "../components/AppShell";
import COADecisionBoard from "../components/coa/COADecisionBoard";
import { useCausalDrilldown } from "../hooks/useCausalDrilldown";

export default function COAsPage() {
  const { openForCoa, drawer } = useCausalDrilldown();

  return (
    <AppShell>
      <COADecisionBoard onOpenCausalTrace={openForCoa} />
      {drawer}
    </AppShell>
  );
}
