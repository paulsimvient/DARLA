import { useEffect, useMemo, useState } from "react";
import { useStudioCore } from "./StudioCoreProvider";
import "./commandPaletteDialog.css";

export default function CommandPaletteDialog() {
  const { commands, eventBus } = useStudioCore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (command) =>
        command.label.toLowerCase().includes(q) ||
        command.id.toLowerCase().includes(q) ||
        command.description?.toLowerCase().includes(q),
    );
  }, [commands, query]);

  if (!open) return null;

  return (
    <div className="darla-command-backdrop" onMouseDown={() => setOpen(false)}>
      <div className="darla-command-palette" onMouseDown={(event) => event.stopPropagation()}>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Run command..."
          className="darla-command-input"
        />
        <div className="darla-command-list">
          {filtered.map((command) => (
            <button
              key={command.id}
              type="button"
              className="darla-command-item"
              onClick={() => {
                command.run({ eventBus });
                eventBus.publish({
                  type: "command.run",
                  source: "CommandPalette",
                  payload: { commandId: command.id },
                });
                setOpen(false);
              }}
            >
              <span>{command.label}</span>
              <small>{command.group}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
