import { Plus, X } from "lucide-react";
import type { ModuleCategory, SimModule } from "../types/moduleCanvas";
import { moduleCategories } from "../types/moduleCanvas";
import Badge from "./Badge";
import { CategoryWireframeIcon } from "./modules/moduleIcons";

export type ModuleDraft = SimModule;

type ModuleInspectorProps = {
  module: SimModule | null;
  onChange: (id: string, patch: Partial<SimModule>) => void;
  onAddInput: (id: string) => void;
  onAddOutput: (id: string) => void;
  onRemoveInput: (id: string, index: number) => void;
  onRemoveOutput: (id: string, index: number) => void;
  onAddTag: (id: string, tag: string) => void;
  onRemoveTag: (id: string, tag: string) => void;
  onSave: (id: string) => void;
  onValidate: (id: string) => void;
  dirty?: boolean;
  readOnly?: boolean;
};

export default function ModuleInspector({
  module,
  onChange,
  onAddInput,
  onAddOutput,
  onRemoveInput,
  onRemoveOutput,
  onAddTag,
  onRemoveTag,
  onSave,
  onValidate,
  dirty,
  readOnly = false,
}: ModuleInspectorProps) {
  if (!module) {
    return (
      <aside className="darla-panel flex h-full w-full flex-col p-5">
        <p className="text-xs text-darla-text-muted">Select a module to edit parameters, category, and I/O.</p>
      </aside>
    );
  }

  return (
    <aside className="darla-panel flex h-full w-full flex-col overflow-hidden">
      <header className="border-b border-darla-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-darla-border bg-darla-bg">
            <CategoryWireframeIcon category={module.category} size={18} className="text-darla-text-secondary" />
          </span>
          <div>
            <h3 className="text-xs font-semibold text-darla-text">Inspector</h3>
            <p className="text-[10px] text-darla-text-muted">{module.id}</p>
          </div>
        </div>
        {readOnly ? (
          <p className="mt-2 text-[10px] font-medium text-sky-300">Live sim entity — read-only</p>
        ) : dirty ? (
          <p className="mt-2 text-[10px] font-medium text-amber-400">Unsaved changes</p>
        ) : null}
      </header>

      <div className="darla-scroll flex-1 space-y-4 overflow-y-auto p-4 text-xs">
        {readOnly ? (
          <>
            <ReadOnlyField label="Module name" value={module.name} />
            <ReadOnlyField label="Type" value={module.type} />
            <ReadOnlyField label="Category" value={module.category} />
            <ReadOnlyField label="Status" value={module.status} />
            <ReadOnlyField label="Description" value={module.description ?? "—"} />
            <ReadOnlyField label="Update rate" value={module.updateRate} />
            <ReadOnlyField label="Range" value={module.range} />
            <ReadOnlyField label="Detection P" value={module.detectionProbability.toFixed(3)} />
            <ReadOnlyField label="Latency" value={module.latency} />
            <ReadOnlyField label="Confidence model" value={module.confidenceModel} />
            <div>
              <span className="mb-1.5 block text-[11px] font-medium text-darla-text-muted">Inputs</span>
              <ul className="space-y-1">
                {module.inputs.map((item) => (
                  <li key={item} className="rounded border border-darla-border bg-darla-bg px-2 py-1 text-[11px]">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <span className="mb-1.5 block text-[11px] font-medium text-darla-text-muted">Outputs</span>
              <ul className="space-y-1">
                {module.outputs.map((item) => (
                  <li key={item} className="rounded border border-darla-border bg-darla-bg px-2 py-1 text-[11px]">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-darla-text-muted">Validation</span>
              <Badge
                tone={
                  module.validationStatus === "pass"
                    ? "green"
                    : module.validationStatus === "fail"
                      ? "red"
                      : "orange"
                }
              >
                {module.validationStatus}
              </Badge>
            </div>
          </>
        ) : (
          <>
        <EditableField
          label="Module name"
          value={module.name}
          onChange={(v) => onChange(module.id, { name: v })}
        />
        <EditableField
          label="Type"
          value={module.type}
          onChange={(v) => onChange(module.id, { type: v })}
        />

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-darla-text-muted">Category</span>
          <select
            className="darla-select w-full"
            value={module.category}
            onChange={(e) => onChange(module.id, { category: e.target.value as ModuleCategory })}
          >
            {moduleCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-darla-text-muted">Status</span>
          <select
            className="darla-select w-full capitalize"
            value={module.status}
            onChange={(e) =>
              onChange(module.id, { status: e.target.value as SimModule["status"] })
            }
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="validated">Validated</option>
          </select>
        </label>

        <EditableField
          label="Description"
          value={module.description ?? ""}
          onChange={(v) => onChange(module.id, { description: v })}
          multiline
        />

        <div className="grid grid-cols-2 gap-2">
          <EditableField
            label="Update rate"
            value={module.updateRate}
            onChange={(v) => onChange(module.id, { updateRate: v })}
          />
          <EditableField
            label="Range"
            value={module.range}
            onChange={(v) => onChange(module.id, { range: v })}
          />
          <EditableField
            label="Latency"
            value={module.latency}
            onChange={(v) => onChange(module.id, { latency: v })}
          />
          <EditableField
            label="Confidence model"
            value={module.confidenceModel}
            onChange={(v) => onChange(module.id, { confidenceModel: v })}
          />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-darla-text-muted">
            Detection probability ({Math.round(module.detectionProbability * 100)}%)
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(module.detectionProbability * 100)}
            onChange={(e) =>
              onChange(module.id, { detectionProbability: Number(e.target.value) / 100 })
            }
            className="w-full accent-darla-blue"
          />
        </label>

        <IoList
          label="Inputs"
          items={module.inputs}
          onAdd={() => onAddInput(module.id)}
          onRemove={(i) => onRemoveInput(module.id, i)}
          onChangeItem={(i, v) => {
            const inputs = [...module.inputs];
            inputs[i] = v;
            onChange(module.id, { inputs });
          }}
        />

        <IoList
          label="Outputs"
          items={module.outputs}
          onAdd={() => onAddOutput(module.id)}
          onRemove={(i) => onRemoveOutput(module.id, i)}
          onChangeItem={(i, v) => {
            const outputs = [...module.outputs];
            outputs[i] = v;
            onChange(module.id, { outputs });
          }}
        />

        <TagEditor
          tags={module.tags ?? []}
          onAdd={(tag) => onAddTag(module.id, tag)}
          onRemove={(tag) => onRemoveTag(module.id, tag)}
        />

        <div>
          <span className="mb-1.5 block text-[11px] font-medium text-darla-text-muted">Validation</span>
          <Badge
            tone={
              module.validationStatus === "pass"
                ? "green"
                : module.validationStatus === "fail"
                  ? "red"
                  : "orange"
            }
          >
            {module.validationStatus}
          </Badge>
        </div>
          </>
        )}
      </div>

      {!readOnly ? (
      <footer className="flex flex-col gap-2 border-t border-darla-border p-4">
        <button type="button" onClick={() => onSave(module.id)} className="darla-btn-primary w-full py-2">
          Save module
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onValidate(module.id)} className="darla-btn py-2">
            Validate
          </button>
          <button type="button" className="darla-btn py-2">
            Run test
          </button>
        </div>
      </footer>
      ) : null}
    </aside>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-1.5 block text-[11px] font-medium text-darla-text-muted">{label}</span>
      <div className="rounded-lg border border-darla-border bg-darla-bg px-2.5 py-2 text-[11px] text-darla-text">
        {value}
      </div>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium text-darla-text-muted">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="darla-input resize-none py-2"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="darla-input py-2"
        />
      )}
    </label>
  );
}

function IoList({
  label,
  items,
  onAdd,
  onRemove,
  onChangeItem,
}: {
  label: string;
  items: string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChangeItem: (index: number, value: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium text-darla-text-muted">{label}</span>
        <button type="button" onClick={onAdd} className="text-darla-text-muted hover:text-darla-blue">
          <Plus size={12} strokeWidth={1.25} />
        </button>
      </div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-1">
            <input
              type="text"
              value={item}
              onChange={(e) => onChangeItem(i, e.target.value)}
              className="darla-input flex-1 py-1.5 text-[11px]"
            />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="rounded p-1.5 text-darla-text-muted hover:text-darla-red"
            >
              <X size={12} strokeWidth={1.25} />
            </button>
          </li>
        ))}
        {items.length === 0 ? (
          <li className="text-[11px] text-darla-text-muted">No {label.toLowerCase()} defined</li>
        ) : null}
      </ul>
    </div>
  );
}

function TagEditor({
  tags,
  onAdd,
  onRemove,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const v = e.currentTarget.value.trim();
      if (v) {
        onAdd(v);
        e.currentTarget.value = "";
      }
    }
  };

  return (
    <div>
      <span className="mb-1.5 block text-[11px] font-medium text-darla-text-muted">Tags</span>
      <div className="mb-2 flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md border border-darla-border bg-darla-bg px-1.5 py-0.5 text-[10px] text-darla-text-secondary"
          >
            {tag}
            <button type="button" onClick={() => onRemove(tag)} className="hover:text-darla-red">
              <X size={10} strokeWidth={1.25} />
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        placeholder="Add tag, press Enter"
        onKeyDown={handleKey}
        className="darla-input py-1.5 text-[11px]"
      />
    </div>
  );
}
