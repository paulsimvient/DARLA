import { Play, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { reloadEditorScript, runEditorScriptOneTick, saveEditorScriptSource } from "../../api";
import type { ScriptTab } from "../../data/mockCoSim";

type ScriptEditorPanelProps = {
  tabs: ScriptTab[];
};

export default function ScriptEditorPanel({ tabs }: ScriptEditorPanelProps) {
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id ?? "");
  const [contents, setContents] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string>("");

  useEffect(() => {
    setContents(Object.fromEntries(tabs.map((tab) => [tab.id, tab.content])));
    if (tabs.length > 0 && !tabs.some((tab) => tab.id === activeTabId)) {
      setActiveTabId(tabs[0].id);
    }
  }, [tabs, activeTabId]);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const activeContent = activeTab ? (contents[activeTab.id] ?? activeTab.content) : "";

  async function saveActiveScript() {
    if (!activeTab || activeTab.language !== "python") return;
    try {
      await saveEditorScriptSource(activeTab.id, activeContent);
      setStatusMessage("Saved");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Save failed");
    }
  }

  async function runActiveScriptOneTick() {
    if (!activeTab || activeTab.language !== "python") return;
    try {
      await reloadEditorScript(activeTab.id);
      await runEditorScriptOneTick(activeTab.id);
      setStatusMessage("Reloaded and ran one tick");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Run failed");
    }
  }

  if (!activeTab) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-darla-border bg-darla-panel p-4 text-xs text-darla-text-secondary">
        No scenario FMU bindings to display.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-darla-border bg-darla-panel">
      <div className="flex items-center justify-between border-b border-darla-border px-2">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              active={activeTabId === tab.id}
              onClick={() => setActiveTabId(tab.id)}
            />
          ))}
        </div>
        <div className="flex shrink-0 gap-1 px-2 py-1">
          <button
            type="button"
            onClick={saveActiveScript}
            disabled={activeTab.language !== "python"}
            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-darla-text-secondary hover:bg-darla-border/30 hover:text-darla-text"
          >
            <Save size={12} />
            Save
          </button>
          <button
            type="button"
            onClick={runActiveScriptOneTick}
            disabled={activeTab.language !== "python"}
            className="flex items-center gap-1 rounded bg-darla-blue px-2 py-1 text-[10px] font-medium text-white hover:bg-darla-blue/90"
          >
            <Play size={12} />
            Run Tick
          </button>
        </div>
      </div>

      <textarea
        value={activeContent}
        onChange={(e) => setContents((prev) => ({ ...prev, [activeTab.id]: e.target.value }))}
        readOnly={activeTab.readOnly ?? activeTab.language !== "python"}
        spellCheck={false}
        className="min-h-0 flex-1 resize-none bg-darla-bg p-4 font-mono text-xs leading-relaxed text-darla-text outline-none"
        aria-label={`Editor: ${activeTab.filename}`}
      />

      <div className="flex items-center justify-between border-t border-darla-border px-3 py-1 text-[10px] text-darla-text-secondary">
        <span>{activeTab.language.toUpperCase()}</span>
        <span>
          {activeTab.error || statusMessage || activeTab.status || (activeTab.readOnly ? "Read-only" : "Editable script component")}
        </span>
      </div>
    </div>
  );
}

function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: ScriptTab;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 border-b-2 px-3 py-2 font-mono text-[10px] transition-colors ${
        active
          ? "border-darla-blue text-darla-text"
          : "border-transparent text-darla-text-secondary hover:text-darla-text"
      }`}
    >
      {tab.filename}
    </button>
  );
}
