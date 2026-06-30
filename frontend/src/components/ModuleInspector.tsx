import type { KeyboardEvent, ReactNode } from "react";
import { Activity, Box, GitBranch, Info, PlayCircle, Plus, ShieldCheck, X } from "lucide-react";
import type { DashboardData, MapEntity, RelationshipEdge } from "../types";
import type { ModuleCategory, SimModule } from "../types/moduleCanvas";
import { moduleCategories } from "../types/moduleCanvas";
import {
  deriveModuleRuntimeState,
  relationshipLabel,
  type ModuleRuntimeState,
} from "../utils/moduleGraphRealism";
import Badge from "./Badge";
import { CategoryWireframeIcon } from "./modules/moduleIcons";

export type ModuleDraft = SimModule;

type ModuleInspectorProps = {
  module: SimModule | null;
  entities?: MapEntity[];
  relationships?: RelationshipEdge[];
  dashboard?: DashboardData | null;
  currentTick?: number;
  onOpenRealism?: () => void;
  onRunCounterfactual?: (moduleId: string) => void;
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
  entities = [],
  relationships = [],
  dashboard = null,
  currentTick = 0,
  onOpenRealism,
  onRunCounterfactual,
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

  const runtime = deriveModuleRuntimeState(module, entities, relationships, dashboard, currentTick);
  const incoming = relationships.filter((edge) => edge.target === module.id);
  const outgoing = relationships.filter((edge) => edge.source === module.id);

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
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone={healthBadgeTone(runtime.health)}>{runtime.health}</Badge>
          <Badge tone={riskBadgeTone(runtime.risk)}>risk {runtime.risk}</Badge>
          <Badge tone="blue">{runtime.provenance}</Badge>
          <Badge tone="neutral">T+{currentTick}</Badge>
        </div>
        {readOnly ? (
          <p className="mt-2 text-[10px] font-medium text-sky-300">Live sim entity — read-only replay object</p>
        ) : dirty ? (
          <p className="mt-2 text-[10px] font-medium text-amber-400">Unsaved changes</p>
        ) : null}
      </header>

      <div className="darla-scroll flex-1 space-y-4 overflow-y-auto p-4 text-xs">
        {readOnly ? (
          <ReadOnlyInspector
            module={module}
            runtime={runtime}
            incoming={incoming}
            outgoing={outgoing}
            onOpenRealism={onOpenRealism}
            onRunCounterfactual={onRunCounterfactual}
          />
        ) : (
          <EditableInspector
            module={module}
            onChange={onChange}
            onAddInput={onAddInput}
            onAddOutput={onAddOutput}
            onRemoveInput={onRemoveInput}
            onRemoveOutput={onRemoveOutput}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
          />
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

function ReadOnlyInspector({
  module,
  runtime,
  incoming,
  outgoing,
  onOpenRealism,
  onRunCounterfactual,
}: {
  module: SimModule;
  runtime: ModuleRuntimeState;
  incoming: RelationshipEdge[];
  outgoing: RelationshipEdge[];
  onOpenRealism?: () => void;
  onRunCounterfactual?: (moduleId: string) => void;
}) {
  return (
    <>
      <Section title="What this is" icon={<Box size={13} />}>
        <p className="text-[11px] leading-relaxed text-darla-text-secondary">{runtime.operationalRole}</p>
      </Section>

      <Section title="Why it matters now" icon={<Activity size={13} />}>
        <p className="text-[11px] leading-relaxed text-darla-text-secondary">{runtime.currentRelevance}</p>
        <p className="mt-2 text-[11px] leading-relaxed text-darla-text-muted">{runtime.causalRole}</p>
      </Section>

      <div className="grid grid-cols-2 gap-2">
        <ReadOnlyField label="Module name" value={module.name} />
        <ReadOnlyField label="Type" value={module.type} />
        <ReadOnlyField label="Category" value={module.category} />
        <ReadOnlyField label="Status" value={module.status} />
        <ReadOnlyField label="Detection P" value={module.detectionProbability.toFixed(3)} />
        <ReadOnlyField label="Latency" value={module.latency} />
      </div>

      <Section title="Available actions" icon={<PlayCircle size={13} />}>
        <div className="space-y-2">
          {runtime.availableActions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => (action.includes("counterfactual") || action.includes("intervention") ? onRunCounterfactual?.(module.id) : onOpenRealism?.())}
              className="darla-btn flex w-full items-center justify-between px-2.5 py-2 text-left text-[11px] capitalize"
            >
              {action}
              <GitBranch size={12} strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </Section>

      <Section title="Relationship ports" icon={<GitBranch size={13} />}>
        <PortList label="Inputs" edges={incoming} direction="in" />
        <PortList label="Outputs" edges={outgoing} direction="out" />
      </Section>

      <Section title="Recent changes" icon={<Activity size={13} />}>
        <ul className="space-y-1">
          {runtime.recentChanges.map((change) => (
            <li key={change} className="rounded border border-darla-border bg-darla-bg px-2 py-1.5 text-[11px] text-darla-text-secondary">
              {change}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Model card" icon={<Info size={13} />}>
        <div className="space-y-2 text-[11px] text-darla-text-secondary">
          <InfoLine label="Model type" value={runtime.modelCard.modelType} />
          <InfoLine label="Validity" value={runtime.modelCard.validity} />
          <InfoLine label="Inputs" value={runtime.modelCard.inputs.join(", ") || "state broadcast"} />
          <InfoLine label="Outputs" value={runtime.modelCard.outputs.join(", ") || "entity state"} />
          <div>
            <span className="mb-1 block text-[10px] uppercase tracking-[0.16em] text-darla-text-muted">Limitations</span>
            <ul className="space-y-1">
              {runtime.modelCard.limitations.map((item) => (
                <li key={item} className="rounded border border-darla-border bg-darla-bg px-2 py-1">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-darla-text-muted">Validation</span>
        <Badge
          tone={
            module.validationStatus === "pass" ? "green" : module.validationStatus === "fail" ? "red" : "orange"
          }
        >
          {module.validationStatus}
        </Badge>
        <ShieldCheck size={13} className="text-darla-text-muted" />
      </div>
    </>
  );
}

function EditableInspector({
  module,
  onChange,
  onAddInput,
  onAddOutput,
  onRemoveInput,
  onRemoveOutput,
  onAddTag,
  onRemoveTag,
}: {
  module: SimModule;
  onChange: (id: string, patch: Partial<SimModule>) => void;
  onAddInput: (id: string) => void;
  onAddOutput: (id: string) => void;
  onRemoveInput: (id: string, index: number) => void;
  onRemoveOutput: (id: string, index: number) => void;
  onAddTag: (id: string, tag: string) => void;
  onRemoveTag: (id: string, tag: string) => void;
}) {
  return (
    <>
      <EditableField label="Module name" value={module.name} onChange={(v) => onChange(module.id, { name: v })} />
      <EditableField label="Type" value={module.type} onChange={(v) => onChange(module.id, { type: v })} />

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
          onChange={(e) => onChange(module.id, { status: e.target.value as SimModule["status"] })}
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
        <EditableField label="Update rate" value={module.updateRate} onChange={(v) => onChange(module.id, { updateRate: v })} />
        <EditableField label="Range" value={module.range} onChange={(v) => onChange(module.id, { range: v })} />
        <EditableField label="Latency" value={module.latency} onChange={(v) => onChange(module.id, { latency: v })} />
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
          onChange={(e) => onChange(module.id, { detectionProbability: Number(e.target.value) / 100 })}
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

      <TagEditor tags={module.tags ?? []} onAdd={(tag) => onAddTag(module.id, tag)} onRemove={(tag) => onRemoveTag(module.id, tag)} />
    </>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-darla-border bg-darla-bg/60 p-3">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-darla-text-muted">
        {icon} {title}
      </div>
      {children}
    </section>
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

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-1 block text-[10px] uppercase tracking-[0.16em] text-darla-text-muted">{label}</span>
      <p className="rounded border border-darla-border bg-darla-bg px-2 py-1.5">{value}</p>
    </div>
  );
}

function PortList({ label, edges, direction }: { label: string; edges: RelationshipEdge[]; direction: "in" | "out" }) {
  return (
    <div className="mb-3 last:mb-0">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-darla-text-muted">{label}</span>
      <ul className="space-y-1">
        {edges.map((edge) => (
          <li key={`${edge.source}-${edge.target}-${edge.type}`} className="rounded border border-darla-border bg-darla-bg px-2 py-1.5 text-[11px] text-darla-text-secondary">
            {direction === "in" ? edge.source : edge.target} · {relationshipLabel(edge.type)}
          </li>
        ))}
        {edges.length === 0 ? <li className="text-[11px] text-darla-text-muted">No {label.toLowerCase()}</li> : null}
      </ul>
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
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className="darla-input resize-none py-2" />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="darla-input py-2" />
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
            <button type="button" onClick={() => onRemove(i)} className="rounded p-1.5 text-darla-text-muted hover:text-darla-red">
              <X size={12} strokeWidth={1.25} />
            </button>
          </li>
        ))}
        {items.length === 0 ? <li className="text-[11px] text-darla-text-muted">No {label.toLowerCase()} defined</li> : null}
      </ul>
    </div>
  );
}

function TagEditor({ tags, onAdd, onRemove }: { tags: string[]; onAdd: (tag: string) => void; onRemove: (tag: string) => void }) {
  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
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
          <span key={tag} className="inline-flex items-center gap-1 rounded-md border border-darla-border bg-darla-bg px-1.5 py-0.5 text-[10px] text-darla-text-secondary">
            {tag}
            <button type="button" onClick={() => onRemove(tag)} className="hover:text-darla-red">
              <X size={10} strokeWidth={1.25} />
            </button>
          </span>
        ))}
      </div>
      <input type="text" placeholder="Add tag, press Enter" onKeyDown={handleKey} className="darla-input py-1.5 text-[11px]" />
    </div>
  );
}

function healthBadgeTone(health: ModuleRuntimeState["health"]): "green" | "orange" | "red" | "blue" | "neutral" {
  if (health === "nominal") return "green";
  if (health === "degraded") return "orange";
  if (health === "compromised") return "red";
  if (health === "intervention") return "blue";
  return "neutral";
}

function riskBadgeTone(risk: ModuleRuntimeState["risk"]): "green" | "orange" | "red" {
  if (risk === "high") return "red";
  if (risk === "medium") return "orange";
  return "green";
}
