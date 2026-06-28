import type { CoSimModel } from "../../data/mockCoSim";
import ModelLibraryItem from "./ModelLibraryItem";

type ModelLibraryPanelProps = {
  models: CoSimModel[];
  selectedId: string | null;
  onSelectModel: (id: string) => void;
};

export default function ModelLibraryPanel({ models, selectedId, onSelectModel }: ModelLibraryPanelProps) {
  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto rounded-lg border border-darla-border bg-darla-panel">
      <h3 className="border-b border-darla-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-darla-text-secondary">
        Model Library
      </h3>
      <div className="flex-1 space-y-4 p-2">
        {models.length === 0 ? (
          <p className="px-2 text-[10px] text-darla-text-secondary">
            No FMUs or Python script components in the active scenario.
          </p>
        ) : (
          <div>
            <div className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-wide text-darla-text-secondary/70">
              Scenario Components
            </div>
            <ul className="space-y-0.5">
              {models.map((model) => (
                <li key={model.id}>
                  <ModelLibraryItem
                    model={model}
                    selected={selectedId === model.id}
                    onSelect={() => onSelectModel(model.id)}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}

export type { CoSimModel };
