type MetricRowProps = {
  label: string;
  value: string | number;
  padValue?: boolean;
};

export default function MetricRow({ label, value, padValue = false }: MetricRowProps) {
  const display =
    padValue && typeof value === "number"
      ? value.toString().padStart(2, "0")
      : value;

  return (
    <div className="flex items-center justify-between py-1 text-[13px]">
      <span className="text-darla-text-muted">{label}</span>
      <span className="font-medium tabular-nums text-darla-text-secondary">{display}</span>
    </div>
  );
}
