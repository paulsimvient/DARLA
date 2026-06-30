const nodeItems = [
  ["Nominal", "bg-emerald-500"],
  ["Degraded", "bg-amber-500"],
  ["Compromised", "bg-red-500"],
  ["Intervention", "bg-sky-400"],
];

const edgeItems = [
  ["commands", "bg-blue-400"],
  ["senses", "bg-cyan-300"],
  ["degrades", "bg-orange-400"],
  ["supports", "bg-violet-400"],
  ["protects", "bg-emerald-400"],
];

export default function ModuleGraphLegend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg border border-darla-border bg-darla-panel/90 p-2.5 shadow-xl backdrop-blur">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-darla-text-muted">Legend</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-darla-text-muted">
        {nodeItems.map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${color}`} /> {label}
          </span>
        ))}
        {edgeItems.map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`h-0.5 w-4 rounded-full ${color}`} /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}
