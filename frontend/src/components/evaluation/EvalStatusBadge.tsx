import type { EvalStatus } from "../../evaluation/types";
import { statusClass, statusLabel } from "../../evaluation/evalUi";

export default function EvalStatusBadge({ status }: { status: EvalStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusClass(status)}`}>
      {statusLabel(status)}
    </span>
  );
}
