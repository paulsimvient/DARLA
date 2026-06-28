import type { COA } from "../data/mockScenario";
import Drawer from "./Drawer";

type COADetailsDrawerProps = {
  coa: COA | null;
  open: boolean;
  onClose: () => void;
};

function riskColor(risk: COA["risk"]) {
  if (risk === "high") return "text-darla-red";
  if (risk === "medium") return "text-darla-orange";
  return "text-darla-green";
}

export default function COADetailsDrawer({ coa, open, onClose }: COADetailsDrawerProps) {
  if (!coa) return null;

  return (
    <Drawer open={open} onClose={onClose} title={`${coa.name} — ${coa.subtitle}`} width="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <DetailField label="Success Probability" value={`${coa.successProbability}%`} highlight />
          <DetailField label="Risk" value={coa.risk} className={riskColor(coa.risk)} capitalize />
          <DetailField label="Expected Time" value={coa.expectedTime} />
          <DetailField label="Resource Demand" value={coa.resourceDemand} capitalize />
          <DetailField label="Confidence" value={`${Math.round(coa.confidence * 100)}%`} />
        </div>

        <Section label="Key Actions">
          <ul className="list-inside list-disc space-y-1 text-sm text-darla-text-secondary">
            {coa.keyActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </Section>

        <Section label="Expected Effects">
          <ul className="list-inside list-disc space-y-1 text-sm text-darla-text-secondary">
            {coa.expectedEffects.map((effect) => (
              <li key={effect}>{effect}</li>
            ))}
          </ul>
        </Section>

        <Section label="Causal Rationale">
          <p className="text-sm leading-relaxed text-darla-text-secondary">{coa.causalRationale}</p>
        </Section>

        <div className="flex gap-2 pt-2">
          <button type="button" className="darla-btn-primary flex-1 py-2">
            Run simulation
          </button>
          <button type="button" className="darla-btn flex-1 py-2">
            Compare
          </button>
          <button type="button" onClick={onClose} className="darla-btn py-2">
            Close
          </button>
        </div>
      </div>
    </Drawer>
  );
}

function DetailField({
  label,
  value,
  highlight,
  className = "",
  capitalize,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  className?: string;
  capitalize?: boolean;
}) {
  return (
    <div className="rounded-lg border border-darla-border bg-darla-surface p-3">
      <div className="text-[10px] uppercase tracking-wide text-darla-text-secondary">{label}</div>
      <div
        className={`mt-0.5 text-sm font-semibold ${highlight ? "text-darla-blue" : "text-darla-text"} ${capitalize ? "capitalize" : ""} ${className}`}
      >
        {value}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-darla-text-secondary">
        {label}
      </h4>
      {children}
    </div>
  );
}
