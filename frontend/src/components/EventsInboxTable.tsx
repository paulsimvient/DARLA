import { useState } from "react";
import { Link } from "react-router-dom";
import Badge from "./Badge";
import Drawer from "./Drawer";
import { useSimulation } from "../context/SimulationContext";
import type { SimEvent } from "../types";

function eventTone(type: string) {
  if (type.includes("cyber") || type.includes("attack")) return "yellow" as const;
  if (type.includes("detect") || type.includes("observation")) return "blue" as const;
  if (type.includes("coa") || type.includes("decision")) return "green" as const;
  if (type.includes("fail") || type.includes("loss")) return "red" as const;
  return "neutral" as const;
}

export default function EventsInboxTable() {
  const { events } = useSimulation();
  const [selectedEvent, setSelectedEvent] = useState<SimEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const recentEvents = [...events].reverse().slice(0, 20);

  const openEvent = (event: SimEvent) => {
    setSelectedEvent(event);
    setSelectedId(event.event_id);
    setDrawerOpen(true);
  };

  return (
    <>
      <section className="flex h-52 shrink-0 flex-col border-t border-darla-border bg-darla-surface">
        <header className="flex shrink-0 items-center justify-between border-b border-darla-border px-4 py-2.5">
          <div>
            <h2 className="text-sm font-semibold text-darla-text">Event Inbox</h2>
            <p className="text-[11px] text-darla-text-muted">
              {events.length} simulation events — click a row for details
            </p>
          </div>
          <Link to="/causal" className="text-[11px] font-medium text-darla-blue hover:text-blue-300">
            Causal graph
          </Link>
        </header>

        <div className="darla-scroll min-h-0 flex-1 overflow-auto">
          {recentEvents.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-darla-text-muted">
              Waiting for simulation events…
            </div>
          ) : (
            <table className="w-full min-w-[900px] text-left text-[12px]">
              <thead className="sticky top-0 z-10 bg-darla-surface">
                <tr className="border-b border-darla-border text-[11px] font-medium text-darla-text-muted">
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Event</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Confidence</th>
                  <th className="px-4 py-2 font-medium">Provenance</th>
                  <th className="px-4 py-2 font-medium">Parents</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((event) => {
                  const selected = selectedId === event.event_id;
                  return (
                    <tr
                      key={event.event_id}
                      onClick={() => openEvent(event)}
                      className={`cursor-pointer border-b border-darla-border/60 transition-colors hover:bg-darla-panel/80 ${
                        selected ? "bg-darla-blue-soft/40 ring-1 ring-inset ring-darla-blue/40" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-darla-text-muted">
                        T+{event.tick}
                      </td>
                      <td className="max-w-xs px-4 py-2.5 font-medium text-darla-text">
                        {event.label || event.type}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={eventTone(event.type)}>{event.type}</Badge>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-darla-text-secondary">
                        {Math.round(event.confidence * 100)}%
                      </td>
                      <td className="px-4 py-2.5 text-darla-text-muted">{event.provenance}</td>
                      <td className="px-4 py-2.5 text-darla-text-secondary">
                        {event.causal_parent_count}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          className="text-[11px] font-medium text-darla-blue hover:text-blue-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEvent(event);
                          }}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <SimEventDrawer
        event={selectedEvent}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}

function SimEventDrawer({
  event,
  open,
  onClose,
}: {
  event: SimEvent | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!event) return null;

  return (
    <Drawer open={open} onClose={onClose} title="Event Details" width="lg">
      <div className="space-y-3 text-sm">
        <Field label="Tick" value={`T+${event.tick}`} />
        <Field label="Label" value={event.label || event.type} />
        <Field label="Type" value={event.type} />
        <Field label="Provenance" value={event.provenance} />
        <Field label="Confidence" value={`${Math.round(event.confidence * 100)}%`} />
        <Field label="Causal parents" value={String(event.causal_parent_count)} />
        {event.deltas.length > 0 ? (
          <div>
            <div className="mb-2 text-[11px] font-medium text-darla-text-muted">Field deltas</div>
            <div className="space-y-1 text-xs text-darla-text-secondary">
              {event.deltas.map((delta) => (
                <div key={delta.field}>
                  {delta.field}: {delta.before} → {delta.after}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-darla-text-muted">{label}</div>
      <div className="mt-0.5 text-darla-text">{value}</div>
    </div>
  );
}
