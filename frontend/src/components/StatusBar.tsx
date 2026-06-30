import { Link } from "react-router-dom";
import { Circle } from "lucide-react";
import { SCENARIOS, useSimulation } from "../context/SimulationContext";

function formatRunTime(tick: number, tickSeconds: number) {
  const totalSeconds = tick * tickSeconds;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function StatusBar() {
  const { scenario, status, currentTick, playback, liveMode, authorizationMode, runIdentity, commandAcks, replayView, compareBranch, activeBranch, timelineDiagnostics } =
    useSimulation();
  const scenarioMeta = SCENARIOS.find((s) => s.id === scenario) ?? SCENARIOS[0];
  const tickSeconds = playback?.tick_seconds ?? 1;
  const running = status === "live" || status === "loading";

  return (
    <footer className="flex h-9 shrink-0 items-center justify-between border-t border-darla-border bg-darla-surface px-5 text-[11px]">
      <div className="flex items-center gap-5 text-darla-text-muted">
        <span className="flex items-center gap-1.5">
          <Circle
            size={6}
            className={running ? "animate-pulse fill-emerald-500 text-emerald-500" : "fill-blue-500 text-blue-500"}
          />
          Simulation:{" "}
          <span className={running ? "text-emerald-400" : "text-darla-text-secondary"}>
            {running ? "Running" : status === "ready" ? "Complete" : status}
          </span>
        </span>
        <span>
          Run Time{" "}
          <span className="font-mono text-darla-text-secondary">
            {formatRunTime(currentTick, tickSeconds)}
          </span>
        </span>
        <span className="hidden sm:inline">
          Scenario <span className="text-darla-text-secondary">{scenarioMeta.label}</span>
        </span>
        <span className="hidden md:inline">
          Mode <span className="text-darla-text-secondary">{authorizationMode.replace(/_/g, " ")}</span>
        </span>
        <span className="hidden xl:inline">
          Timeline{" "}
          <span className="text-darla-text-secondary">
            {timelineDiagnostics.playState.replace(/_/g, " ")}
          </span>
          {timelineDiagnostics.pauseReason ? (
            <span className="text-amber-300/90">
              {" "}· {timelineDiagnostics.pauseReason.kind.replace(/_/g, " ")} T+
              {timelineDiagnostics.pauseReason.tick}
            </span>
          ) : null}
        </span>
        {runIdentity ? (
          <span className="hidden lg:inline">
            Run{" "}
            <span className="font-mono text-darla-text-secondary">
              {runIdentity.run_id.slice(0, 8)}
            </span>{" "}
            · {runIdentity.branch_id}
            {replayView === "compare" && compareBranch
              ? ` · compare vs ${compareBranch.branch_id}`
              : replayView === "branch" && activeBranch
                ? ` · viewing ${activeBranch.branch_id}`
                : ""}
          </span>
        ) : null}
        {commandAcks.at(-1) ? (
          <span className="hidden xl:inline text-emerald-400/90">
            Last cmd: {commandAcks.at(-1)?.message.slice(0, 40)}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-darla-text-muted">
          <Circle size={5} className="fill-emerald-500 text-emerald-500" />
          Data Freshness: {liveMode && running ? "Live" : "Replay"}
          {timelineDiagnostics.lastFrameReceivedAt && running
            ? ` · last frame ${Math.max(0, Math.round((Date.now() - timelineDiagnostics.lastFrameReceivedAt) / 1000))}s ago`
            : ""}
        </span>
        <Link to="/replay-3d" className="darla-btn darla-btn-primary py-1 text-[11px]">
          Open 3D Replay
        </Link>
      </div>
    </footer>
  );
}
