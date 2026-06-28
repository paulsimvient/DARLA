import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ModuleCategory, SimModule } from "../types/moduleCanvas";
import { moduleCategories } from "../types/moduleCanvas";
import { CategoryWireframeIcon, ModuleWireframeIcon } from "./modules/moduleIcons";

type ModuleLibraryProps = {
  modules: SimModule[];
  selectedCategory: ModuleCategory | null;
  selectedId: string | null;
  onSelectCategory: (category: ModuleCategory | null) => void;
  onSelectModule: (id: string) => void;
  onAddToCanvas: (id: string) => void;
  onCreateModule: (category: ModuleCategory) => void;
  readOnly?: boolean;
};

export default function ModuleLibrary({
  modules,
  selectedCategory,
  selectedId,
  onSelectCategory,
  onSelectModule,
  onAddToCanvas,
  onCreateModule,
  readOnly = false,
}: ModuleLibraryProps) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<ModuleCategory | "all">>(
    () => new Set([...moduleCategories, "all"]),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return modules.filter((m) => {
      if (selectedCategory && m.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.type.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.tags?.some((t) => t.includes(q))
      );
    });
  }, [modules, selectedCategory, search]);

  const grouped = useMemo(() => {
    const map = new Map<ModuleCategory, SimModule[]>();
    for (const cat of moduleCategories) map.set(cat, []);
    for (const mod of filtered) {
      map.get(mod.category)?.push(mod);
    }
    return map;
  }, [filtered]);

  const toggleSection = (key: ModuleCategory | "all") => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <aside className="darla-panel flex h-full w-full flex-col overflow-hidden">
      <div className="border-b border-darla-border p-3">
        <h3 className="text-xs font-semibold text-darla-text">Module library</h3>
        <p className="mt-0.5 text-[11px] text-darla-text-muted">Browse, categorize, add to canvas</p>
        <div className="relative mt-3">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-darla-text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search modules…"
            className="darla-input py-2 pl-8 text-[12px]"
          />
        </div>
      </div>

      <div className="border-b border-darla-border px-2 py-2">
        <button
          type="button"
          onClick={() => onSelectCategory(null)}
          className={`darla-btn w-full justify-start !text-[11px] ${
            selectedCategory === null ? "!border-darla-blue/40 !bg-darla-blue-soft/30 !text-darla-blue" : ""
          }`}
        >
          All categories
        </button>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {moduleCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => onSelectCategory(selectedCategory === cat ? null : cat)}
              title={cat}
              className={`flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] transition-colors ${
                selectedCategory === cat
                  ? "border-darla-blue/40 bg-darla-blue-soft/30 text-darla-blue"
                  : "border-darla-border text-darla-text-muted hover:border-darla-border-subtle hover:text-darla-text-secondary"
              }`}
            >
              <CategoryWireframeIcon category={cat} size={12} />
              <span className="max-w-[72px] truncate">{cat.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="darla-scroll min-h-0 flex-1 overflow-y-auto p-2">
        <CategorySection
          title="All modules"
          count={filtered.length}
          open={expanded.has("all")}
          onToggle={() => toggleSection("all")}
        >
          {filtered.map((mod) => (
            <ModuleLibraryRow
              key={mod.id}
              module={mod}
              selected={selectedId === mod.id}
              onSelect={() => onSelectModule(mod.id)}
              onAdd={readOnly ? undefined : () => onAddToCanvas(mod.id)}
            />
          ))}
        </CategorySection>

        {moduleCategories.map((cat) => {
          const items = grouped.get(cat) ?? [];
          if (items.length === 0) return null;
          return (
            <CategorySection
              key={cat}
              title={cat}
              icon={<CategoryWireframeIcon category={cat} size={14} className="text-darla-text-muted" />}
              count={items.length}
              open={expanded.has(cat)}
              onToggle={() => toggleSection(cat)}
              onAdd={readOnly ? undefined : () => onCreateModule(cat)}
            >
              {items.map((mod) => (
                <ModuleLibraryRow
                  key={mod.id}
                  module={mod}
                  selected={selectedId === mod.id}
                  onSelect={() => onSelectModule(mod.id)}
                  onAdd={readOnly ? undefined : () => onAddToCanvas(mod.id)}
                />
              ))}
            </CategorySection>
          );
        })}
      </div>
    </aside>
  );
}

function CategorySection({
  title,
  icon,
  count,
  open,
  onToggle,
  onAdd,
  children,
}: {
  title: string;
  icon?: ReactNode;
  count: number;
  open: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="mb-2">
      <div className="flex items-center gap-1 rounded-md px-1 py-1 hover:bg-darla-panel-elevated/50">
        <button type="button" onClick={onToggle} className="flex flex-1 items-center gap-1.5 text-left">
          {open ? <ChevronDown size={12} className="text-darla-text-muted" /> : <ChevronRight size={12} className="text-darla-text-muted" />}
          {icon}
          <span className="text-[11px] font-medium text-darla-text-secondary">{title}</span>
          <span className="ml-auto rounded bg-darla-panel-elevated px-1.5 text-[10px] tabular-nums text-darla-text-muted">
            {count}
          </span>
        </button>
        {onAdd ? (
          <button
            type="button"
            onClick={onAdd}
            title={`New ${title} module`}
            className="rounded p-1 text-darla-text-muted hover:bg-darla-panel-elevated hover:text-darla-blue"
          >
            <Plus size={12} strokeWidth={1.25} />
          </button>
        ) : null}
      </div>
      {open ? <div className="ml-1 space-y-0.5 border-l border-darla-border pl-2">{children}</div> : null}
    </section>
  );
}

function ModuleLibraryRow({
  module,
  selected,
  onSelect,
  onAdd,
}: {
  module: SimModule;
  selected: boolean;
  onSelect: () => void;
  onAdd?: () => void;
}) {
  return (
    <div
      className={`group flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors ${
        selected ? "bg-darla-blue-soft/30 ring-1 ring-inset ring-darla-blue/30" : "hover:bg-darla-panel-elevated/60"
      }`}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-darla-border bg-darla-bg">
          <ModuleWireframeIcon module={module} size={14} className="text-darla-text-secondary" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[11px] font-medium text-darla-text">{module.name}</span>
          <span className="block truncate text-[10px] text-darla-text-muted">{module.type}</span>
        </span>
      </button>
      {module.onCanvas ? (
        <span className="shrink-0 text-[9px] text-darla-text-muted">on canvas</span>
      ) : onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          title="Add to canvas"
          className="shrink-0 rounded p-1 text-darla-text-muted opacity-0 transition-opacity hover:text-darla-blue group-hover:opacity-100"
        >
          <Plus size={12} strokeWidth={1.25} />
        </button>
      ) : null}
    </div>
  );
}
