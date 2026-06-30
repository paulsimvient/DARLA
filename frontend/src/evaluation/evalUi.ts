import type { EvalStatus } from "./types";

export function statusLabel(status: EvalStatus): string {
  switch (status) {
    case "pass": return "Pass";
    case "watch": return "Watch";
    case "fail": return "Fail";
    case "not_run": return "Not run";
  }
}

export function statusClass(status: EvalStatus): string {
  switch (status) {
    case "pass": return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "watch": return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "fail": return "border-red-500/30 bg-red-500/10 text-red-300";
    case "not_run": return "border-darla-border bg-darla-panel-elevated text-darla-text-muted";
  }
}

export function pct(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}
