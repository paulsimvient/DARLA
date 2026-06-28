import type { TimelineEvent } from "../data/mockScenario";

const typeColors: Record<TimelineEvent["type"], string> = {
  observation: "bg-darla-blue",
  cyber: "bg-purple-500",
  kinetic: "bg-darla-red",
  effect: "bg-darla-orange",
  movement: "bg-darla-green",
  warning: "bg-darla-red",
};

type EventMarkerProps = {
  event: TimelineEvent;
  active?: boolean;
  onClick: () => void;
};

export default function EventMarker({ event, active, onClick }: EventMarkerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-w-[140px] max-w-[180px] shrink-0 flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors ${
        active
          ? "border-darla-blue bg-darla-blue/10"
          : "border-darla-border bg-darla-panel hover:border-darla-border/80 hover:bg-darla-panel-elevated"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${typeColors[event.type]}`} />
        <span className="font-mono text-[10px] text-darla-text-secondary">{event.timestamp}</span>
      </div>
      <span className="mt-1 line-clamp-2 text-[11px] leading-snug text-darla-text group-hover:text-white">
        {event.title}
      </span>
    </button>
  );
}

export { typeColors };
