import type { SimEvent } from "../../types";
import { formatSimTime } from "../../utils/simTime";
import type { TimelineLaneMarkerModel } from "../../utils/timelineMarkers";
import { tickToPx, TIMELINE_DISPLAY_LANES } from "../../utils/timelineGroupSelection";

type TimelineLaneMarkerProps = {
  marker: TimelineLaneMarkerModel;
  lane: (typeof TIMELINE_DISPLAY_LANES)[number];
  pxPerTick: number;
  tickSeconds: number;
  inRange: boolean;
  active: boolean;
  future?: boolean;
  onSelect: (event: SimEvent) => void;
};

const LANE_MARKER_CLASS: Record<(typeof TIMELINE_DISPLAY_LANES)[number]["id"], string> = {
  cyber: "bg-red-500 border-red-300/80",
  detect: "bg-amber-400 border-amber-200/80",
  coa: "bg-blue-500 border-blue-300/80",
  exec: "bg-emerald-500 border-emerald-300/80",
};

const SIGNIFICANCE_SIZE: Record<TimelineLaneMarkerModel["significance"], string> = {
  minor: "h-2 w-2 border",
  major: "h-3 w-3 border-2",
  urgent: "h-3.5 w-3.5 border-2 ring-2 ring-red-400/70 animate-pulse",
};

export default function TimelineLaneMarker({
  marker,
  lane,
  pxPerTick,
  tickSeconds,
  inRange,
  active,
  future = false,
  onSelect,
}: TimelineLaneMarkerProps) {
  const { event, significance, clusterCount, headline, inspectPrompt } = marker;
  const left = tickToPx(event.tick, pxPerTick);
  const title = `${formatSimTime(event.tick, tickSeconds, true)} · ${headline} · ${inspectPrompt}`;
  const colors = LANE_MARKER_CLASS[lane.id];

  return (
    <button
      type="button"
      className={`absolute top-1/2 z-[4] -translate-x-1/2 -translate-y-1/2 rounded-full shadow-sm transition-transform hover:scale-125 ${colors} ${SIGNIFICANCE_SIZE[significance]} ${
        active
          ? "scale-125 border-white ring-2 ring-white/80"
          : inRange
            ? "border-white ring-2 ring-blue-400/70"
            : future
              ? "border-dashed opacity-45 hover:opacity-70"
              : "opacity-90 hover:opacity-100"
      }`}
      style={{ left }}
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(event);
      }}
    >
      {clusterCount > 1 ? (
        <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[8px] font-bold text-white ring-1 ring-white/40">
          {clusterCount}
        </span>
      ) : null}
      <span className="sr-only">{formatSimTime(event.tick, tickSeconds)}</span>
    </button>
  );
}
