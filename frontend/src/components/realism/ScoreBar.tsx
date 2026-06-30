type ScoreBarProps = {
  value: number;
  label?: string;
  tone?: "blue" | "green" | "amber" | "red" | "neutral";
};

function toneClass(tone: ScoreBarProps["tone"] = "blue") {
  switch (tone) {
    case "green":
      return "bg-emerald-400";
    case "amber":
      return "bg-amber-400";
    case "red":
      return "bg-red-400";
    case "neutral":
      return "bg-slate-400";
    default:
      return "bg-blue-400";
  }
}

export default function ScoreBar({ value, label, tone = "blue" }: ScoreBarProps) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className="min-w-0">
      {label ? (
        <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-darla-text-muted">
          <span className="truncate">{label}</span>
          <span className="font-mono text-darla-text-secondary">{Math.round(pct)}%</span>
        </div>
      ) : null}
      <div className="h-1.5 overflow-hidden rounded-full bg-darla-bg">
        <div className={`h-full rounded-full ${toneClass(tone)}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
