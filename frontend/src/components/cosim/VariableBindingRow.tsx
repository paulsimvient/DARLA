import type { VariableBinding } from "../../data/mockCoSim";

type VariableBindingRowProps = {
  binding: VariableBinding;
};

export default function VariableBindingRow({ binding }: VariableBindingRowProps) {
  const arrow = binding.direction === "input" ? "←" : "→";

  return (
    <div className="flex items-start gap-2 font-mono text-[10px] leading-relaxed">
      <span className="shrink-0 text-darla-text">{binding.variable}</span>
      <span className="shrink-0 text-darla-text-secondary">{arrow}</span>
      <span className="min-w-0 break-all text-darla-blue">{binding.binding}</span>
    </div>
  );
}
