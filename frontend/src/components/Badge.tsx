import type { ReactNode } from "react";

type BadgeTone = "neutral" | "blue" | "green" | "red" | "orange" | "yellow";

const toneStyles: Record<BadgeTone, string> = {
  neutral: "bg-zinc-800 text-zinc-300 border-zinc-700",
  blue: "bg-blue-950/60 text-blue-300 border-blue-900/50",
  green: "bg-emerald-950/60 text-emerald-400 border-emerald-900/50",
  red: "bg-red-950/60 text-red-400 border-red-900/50",
  orange: "bg-amber-950/60 text-amber-400 border-amber-900/50",
  yellow: "bg-yellow-950/60 text-yellow-400 border-yellow-900/50",
};

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

export default function Badge({ children, tone = "neutral", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize ${toneStyles[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function eventTypeTone(type: string): BadgeTone {
  switch (type) {
    case "observation":
      return "blue";
    case "cyber":
      return "yellow";
    case "kinetic":
      return "red";
    case "effect":
      return "orange";
    case "movement":
      return "green";
    case "warning":
      return "red";
    default:
      return "neutral";
  }
}

export function riskTone(risk: string): BadgeTone {
  if (risk === "high") return "red";
  if (risk === "medium") return "orange";
  return "green";
}
