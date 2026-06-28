import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { fetchProvenance } from "../api";
import { SCENARIOS, useSimulation } from "../context/SimulationContext";
import { buildDataProvenance, type ScenarioProvenanceFile } from "../utils/dataProvenance";

export default function DataProvenancePanel() {
  const { scenario, dashboard, runIdentity } = useSimulation();
  const [open, setOpen] = useState(false);
  const [provenanceFile, setProvenanceFile] = useState<ScenarioProvenanceFile | null>(null);
  const scenarioMeta = SCENARIOS.find((entry) => entry.id === scenario) ?? SCENARIOS[0];

  useEffect(() => {
    let cancelled = false;
    fetchProvenance(scenarioMeta.id)
      .then((payload) => {
        if (!cancelled) setProvenanceFile(payload);
      })
      .catch(() => {
        if (!cancelled) setProvenanceFile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [scenarioMeta.id]);

  const provenance = useMemo(
    () => buildDataProvenance(dashboard, runIdentity, scenarioMeta.id, provenanceFile),
    [dashboard, runIdentity, scenarioMeta.id, provenanceFile],
  );

  return (
    <div className="shrink-0 border-t border-darla-border bg-[#0a0e14]">
      <button
        type="button"
        className="flex w-full items-center justify-between px-5 py-1.5 text-left text-[11px] text-darla-text-muted hover:bg-darla-panel/40"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Info size={12} className="text-blue-400" />
          <span>
            Data provenance · <span className="text-darla-text-secondary">{provenance.dataMode}</span>
            {provenance.replayHash !== "—" ? (
              <>
                {" "}
                · hash{" "}
                <span className="font-mono text-darla-text-secondary">
                  {provenance.replayHash.slice(0, 12)}
                </span>
              </>
            ) : null}
          </span>
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronUp size={14} className="rotate-180" />}
      </button>

      {open ? (
        <div className="grid gap-1 border-t border-darla-border/60 px-5 py-2 text-[11px] text-darla-text-muted md:grid-cols-2">
          <ProvenanceRow label="Scenario" value={provenance.scenarioId} />
          <ProvenanceRow label="Seed" value={provenance.seed} mono />
          <ProvenanceRow label="Replay hash" value={provenance.replayHash} mono />
          <ProvenanceRow label="Data mode" value={provenance.dataMode} />
          <ProvenanceRow label="Map data" value={provenance.mapData} />
          <ProvenanceRow label="Weather" value={provenance.weather} />
          <ProvenanceRow label="AIS" value={provenance.ais} />
          <ProvenanceRow label="FMU" value={provenance.fmu} />
          <ProvenanceRow label="Python script" value={provenance.pythonScript} />
          <ProvenanceRow label="VV&A status" value={provenance.vvaStatus} className="md:col-span-2" />
        </div>
      ) : null}
    </div>
  );
}

function ProvenanceRow({
  label,
  value,
  mono = false,
  className = "",
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className="text-darla-text-muted">{label}: </span>
      <span className={mono ? "font-mono text-darla-text-secondary" : "text-darla-text-secondary"}>
        {value}
      </span>
    </div>
  );
}
