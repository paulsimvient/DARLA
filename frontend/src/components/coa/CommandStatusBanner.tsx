import type { SimCommandAck } from "../../types";

type CommandStatusBannerProps = {
  acks: SimCommandAck[];
};

export default function CommandStatusBanner({ acks }: CommandStatusBannerProps) {
  const latest = acks.at(-1);
  if (!latest) return null;

  const tone = latest.ok
    ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-100"
    : "border-red-500/30 bg-red-950/20 text-red-100";

  return (
    <div className={`rounded-xl border px-3 py-2 text-[11px] ${tone}`}>
      <div className="font-semibold">
        {latest.ok ? "Sim command applied" : "Sim command failed"}
        {latest.type ? ` · ${latest.type.replace(/_/g, " ")}` : null}
      </div>
      <div className="mt-0.5 opacity-90">
        {latest.message} · event #{latest.event_id} at T+{latest.tick}
      </div>
    </div>
  );
}
