import { selectionLabel } from "../studio-core/selection";
import { useStudioCore } from "../studio-core/StudioCoreProvider";

export default function StudioFoundationStatus() {
  const { workspaceId, selection, layouts, commands } = useStudioCore();

  return (
    <section className="rounded-xl border border-darla-border bg-darla-panel p-3 text-xs text-darla-text-secondary">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-darla-text-muted">
        Studio Foundation
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Metric label="Workspace" value={workspaceId} />
        <Metric label="Selection" value={selectionLabel(selection)} />
        <Metric label="Layouts" value={Object.keys(layouts).length.toString()} />
        <Metric label="Commands" value={commands.length.toString()} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-darla-border bg-darla-bg p-2">
      <div className="text-[10px] uppercase tracking-wide text-darla-text-muted">{label}</div>
      <div className="mt-1 truncate font-semibold text-darla-text">{value}</div>
    </div>
  );
}
