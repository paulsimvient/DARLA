import { Check, Circle } from "lucide-react";
import type { CoSimModel, ValidationState } from "../../data/mockCoSim";

type ModelLibraryItemProps = {
  model: CoSimModel;
  selected: boolean;
  onSelect: () => void;
};

function validationIcon(state: ValidationState) {
  if (state === "validated") return <Check size={10} className="text-darla-green" />;
  if (state === "failed") return <Circle size={10} className="text-darla-red" />;
  return <Circle size={10} className="text-darla-orange" />;
}

export default function ModelLibraryItem({ model, selected, onSelect }: ModelLibraryItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-start gap-2 rounded px-2 py-1.5 text-left transition-colors ${
        selected
          ? "bg-darla-blue/15 text-darla-blue"
          : "text-darla-text-secondary hover:bg-darla-panel-elevated hover:text-darla-text"
      }`}
    >
      <span className="mt-0.5 shrink-0">{validationIcon(model.validationState)}</span>
      <span className="min-w-0 truncate text-xs">{model.filename ?? model.name}</span>
    </button>
  );
}

export { validationIcon };
