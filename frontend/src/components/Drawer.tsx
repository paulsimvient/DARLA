import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: "md" | "lg";
};

export default function Drawer({ open, onClose, title, children, width = "md" }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const widthClass = width === "lg" ? "w-[440px]" : "w-[380px]";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close drawer"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside
        className={`relative flex h-full ${widthClass} flex-col border-l border-darla-border bg-darla-panel shadow-2xl`}
      >
        <header className="flex items-center justify-between border-b border-darla-border px-5 py-4">
          <h2 className="text-sm font-semibold text-darla-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-darla-text-muted transition-colors hover:bg-darla-panel-elevated hover:text-darla-text"
          >
            <X size={16} />
          </button>
        </header>
        <div className="darla-scroll flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}
