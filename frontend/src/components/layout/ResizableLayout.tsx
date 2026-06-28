import { useEffect, useState, type ReactNode } from "react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
  type GroupProps,
  type PanelProps,
} from "react-resizable-panels";
import { DARLA_LAYOUT_RESET_EVENT } from "../../utils/layoutStorage";

type GroupWrapProps = GroupProps & {
  className?: string;
  autoSaveId?: string;
};

type PanelWrapProps = Omit<PanelProps, "defaultSize" | "minSize" | "maxSize"> & {
  className?: string;
  children: ReactNode;
  defaultSize?: number | string;
  minSize?: number | string;
  maxSize?: number | string;
};

function asPercent(value: number | string | undefined): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  return `${value}%`;
}

function PersistedGroup({
  orientation,
  groupId,
  className = "",
  children,
  ...props
}: GroupWrapProps & { orientation: "horizontal" | "vertical"; groupId: string }) {
  const [resetKey, setResetKey] = useState(0);
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: groupId });

  useEffect(() => {
    const onReset = () => setResetKey((key) => key + 1);
    window.addEventListener(DARLA_LAYOUT_RESET_EVENT, onReset);
    return () => window.removeEventListener(DARLA_LAYOUT_RESET_EVENT, onReset);
  }, []);

  return (
    <Group
      key={`${groupId}-${resetKey}`}
      orientation={orientation}
      id={groupId}
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
      className={`min-h-0 min-w-0 flex-1 ${className}`}
      {...props}
    >
      {children}
    </Group>
  );
}

export function HGroup({ className = "", autoSaveId, id, ...props }: GroupWrapProps) {
  const groupId = id ?? autoSaveId;
  if (groupId) {
    return <PersistedGroup orientation="horizontal" groupId={groupId} className={className} {...props} />;
  }
  return (
    <Group
      orientation="horizontal"
      className={`min-h-0 min-w-0 flex-1 ${className}`}
      {...props}
    />
  );
}

export function VGroup({ className = "", autoSaveId, id, ...props }: GroupWrapProps) {
  const groupId = id ?? autoSaveId;
  if (groupId) {
    return <PersistedGroup orientation="vertical" groupId={groupId} className={className} {...props} />;
  }
  return (
    <Group orientation="vertical" className={`min-h-0 min-w-0 flex-1 ${className}`} {...props} />
  );
}

export function RPanel({
  className = "",
  children,
  defaultSize,
  minSize,
  maxSize,
  ...props
}: PanelWrapProps) {
  return (
    <Panel
      className={`min-h-0 min-w-0 ${className}`}
      defaultSize={asPercent(defaultSize)}
      minSize={asPercent(minSize)}
      maxSize={asPercent(maxSize)}
      {...props}
    >
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">{children}</div>
    </Panel>
  );
}

function ResizeGripDots() {
  const dotClass =
    "h-1 w-1 shrink-0 rounded-full bg-darla-border-subtle transition-colors group-hover:bg-darla-blue/80 group-data-[separator=active]:bg-darla-blue group-data-[separator=focus]:bg-darla-blue/70";

  return (
    <>
      <div
        aria-hidden
        className="resize-grip-col pointer-events-none hidden flex-col items-center gap-1.5 py-3"
      >
        <span className={dotClass} />
        <span className={dotClass} />
        <span className={dotClass} />
      </div>
      <div
        aria-hidden
        className="resize-grip-row pointer-events-none hidden flex-row items-center gap-1.5 px-3"
      >
        <span className={dotClass} />
        <span className={dotClass} />
        <span className={dotClass} />
      </div>
    </>
  );
}

export function RHandle({ className = "" }: { className?: string }) {
  return (
    <Separator
      title="Drag to resize"
      className={`group relative z-20 flex shrink-0 items-center justify-center border-darla-border-subtle/70 bg-darla-surface/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)] transition-[background-color,border-color,box-shadow] hover:border-darla-blue/45 hover:bg-darla-panel-elevated hover:shadow-[0_0_0_1px_rgba(59,130,246,0.22)] data-[separator=active]:border-darla-blue/60 data-[separator=active]:bg-darla-blue/10 data-[separator=focus]:border-darla-blue/40 [&[aria-orientation=vertical]_.resize-grip-col]:flex [&[aria-orientation=horizontal]_.resize-grip-row]:flex [&[aria-orientation=vertical]]:mx-0.5 [&[aria-orientation=vertical]]:w-3.5 [&[aria-orientation=vertical]]:cursor-col-resize [&[aria-orientation=vertical]]:border-x [&[aria-orientation=horizontal]]:my-0.5 [&[aria-orientation=horizontal]]:h-3.5 [&[aria-orientation=horizontal]]:w-full [&[aria-orientation=horizontal]]:cursor-row-resize [&[aria-orientation=horizontal]]:border-y ${className}`}
    >
      <ResizeGripDots />
    </Separator>
  );
}

export { Group, Panel, Separator };
