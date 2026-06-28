import type { ReactNode } from "react";

type SectionCardProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export default function SectionCard({ title, children, className = "" }: SectionCardProps) {
  return (
    <section
      className={`rounded-lg border border-darla-border bg-darla-panel p-3 ${className}`}
    >
      {title ? (
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-darla-text-secondary">
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}
