import type { ReactNode } from "react";
import type { CoSimModel } from "../../data/mockCoSim";
import VariableBindingRow from "./VariableBindingRow";

type FMUInspectorPanelProps = {
  model: CoSimModel | null;
};

function validationLabel(state: CoSimModel["validationState"]) {
  const styles = {
    validated: "text-darla-green bg-darla-green/10",
    pending: "text-darla-orange bg-darla-orange/10",
    failed: "text-darla-red bg-darla-red/10",
    draft: "text-darla-text-secondary bg-darla-border/30",
  };
  return styles[state];
}

function formatValue(value: number | undefined) {
  if (value === undefined) return "—";
  return value.toFixed(4);
}

export default function FMUInspectorPanel({ model }: FMUInspectorPanelProps) {
  if (!model) {
    return (
      <aside className="flex h-full w-full flex-col rounded-lg border border-darla-border bg-darla-panel p-4">
        <p className="text-xs text-darla-text-secondary">
          Select a model from the library to inspect FMI metadata, variables, and bindings.
        </p>
      </aside>
    );
  }

  const isFmu = model.category === "fmu";

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto rounded-lg border border-darla-border bg-darla-panel">
      <header className="border-b border-darla-border px-3 py-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-darla-text-secondary">
          Inspector
        </h3>
        <div className="mt-1 truncate font-mono text-xs text-darla-text">
          {model.filename ?? model.name}
        </div>
        {model.description ? (
          <p className="mt-1 text-[10px] text-darla-text-secondary">{model.description}</p>
        ) : null}
      </header>

      <div className="space-y-4 p-3 text-xs">
        {isFmu ? (
          <Section title="Interface">
            <Field label="Load Mode" value={model.loadMode ?? "—"} />
            <Field label="FMI Version" value={model.fmiVersion ?? "—"} />
            <Field label="Type" value={model.interfaceType ?? "—"} />
            <Field label="Step Size" value={model.stepSize ?? "—"} />
            <Field label="Last Step Time" value={model.lastStepTime !== undefined ? `${model.lastStepTime}s` : "—"} />
            <Field label="Status" value={model.status} capitalize />
          </Section>
        ) : (
          <Section title="Module">
            <Field label="Category" value={model.category.replace("_", " ")} capitalize />
            <Field label="Status" value={model.status} capitalize />
          </Section>
        )}

        {model.liveInputs && model.liveInputs.length > 0 ? (
          <Section title="Live Inputs">
            <ul className="space-y-1">
              {model.liveInputs.map((input) => (
                <li key={input.port} className="font-mono text-[10px] text-darla-text-secondary">
                  <span className="text-darla-text">{input.port}</span>
                  <span className="text-darla-green"> = {formatValue(input.value)}</span>
                  {input.worldPath ? (
                    <span className="block text-darla-text-secondary/60">← {input.worldPath}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {model.liveOutputs && model.liveOutputs.length > 0 ? (
          <Section title="Live Outputs">
            <ul className="space-y-1">
              {model.liveOutputs.map((output) => (
                <li key={output.port} className="font-mono text-[10px] text-darla-text-secondary">
                  <span className="text-darla-text">{output.port}</span>
                  <span className="text-darla-blue"> = {formatValue(output.value)}</span>
                  {output.worldPath ? (
                    <span className="block text-darla-text-secondary/60">→ {output.worldPath}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {model.inputs.length > 0 ? (
          <Section title="Inputs">
            <ul className="space-y-1">
              {model.inputs.map((v) => (
                <li key={v.name} className="font-mono text-[10px] text-darla-text-secondary">
                  <span className="text-darla-text">{v.name}</span>
                  <span className="text-darla-text-secondary/70">: {v.type}</span>
                  {v.unit ? <span className="text-darla-text-secondary/50"> ({v.unit})</span> : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {model.outputs.length > 0 ? (
          <Section title="Outputs">
            <ul className="space-y-1">
              {model.outputs.map((v) => (
                <li key={v.name} className="font-mono text-[10px] text-darla-text-secondary">
                  <span className="text-darla-text">{v.name}</span>
                  <span className="text-darla-text-secondary/70">: {v.type}</span>
                  {v.unit ? <span className="text-darla-text-secondary/50"> ({v.unit})</span> : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {model.bindings.length > 0 ? (
          <Section title="Bindings">
            <div className="space-y-1.5">
              {model.bindings.map((b) => (
                <VariableBindingRow key={`${b.variable}-${b.direction}`} binding={b} />
              ))}
            </div>
          </Section>
        ) : (
          <Section title="Bindings">
            <span className="text-[10px] text-darla-text-secondary">No bindings configured</span>
          </Section>
        )}

        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-darla-text-secondary">
            Validation
          </div>
          <span className={`inline-block rounded px-1.5 py-0.5 capitalize ${validationLabel(model.validationState)}`}>
            {model.validationState}
          </span>
        </div>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-darla-text-secondary">
        {title}
      </h4>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2 py-0.5">
      <span className="text-darla-text-secondary">{label}</span>
      <span className={`text-darla-text ${capitalize ? "capitalize" : ""}`}>{value}</span>
    </div>
  );
}
