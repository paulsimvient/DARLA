import { DarlaSelection, useDarlaSelection } from "../context/SelectionContext";

/**
 * Small helper for wrapping existing rows/cards without rewriting them.
 *
 * Example:
 * <Selectable selection={{kind:"event", id:event.id, tick:event.tick, payload:event}}>
 *   <ExistingEventCard event={event} />
 * </Selectable>
 */
export function Selectable({
  selection,
  children,
  className,
}: {
  selection: DarlaSelection;
  children: React.ReactNode;
  className?: string;
}) {
  const { setSelection } = useDarlaSelection();

  return (
    <div
      className={className}
      onClick={() => setSelection(selection)}
      style={{ cursor: "pointer" }}
    >
      {children}
    </div>
  );
}
