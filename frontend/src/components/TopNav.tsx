import { Bell, ChevronDown, Settings } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { SCENARIOS, useSimulation } from "../context/SimulationContext";
import { resetPanelLayoutsToDefaults } from "../utils/layoutStorage";

const studioTabs = [
  { path: "/mission", label: "Mission", help: "Operational picture, map, timeline, explorer" },
  { path: "/reason", label: "Reason", help: "Mission reasoning debugger and evidence chain" },
  { path: "/decide", label: "Decide", help: "COAs, gates, authority, recommendations" },
  { path: "/build", label: "Build", help: "Modules, models, FMUs, agents, scenarios" },
  { path: "/replay", label: "Replay", help: "Mission, reasoning, decision, and evidence replay" },
  { path: "/validation", label: "Validation", help: "Credibility, realism, evaluation, VV&A" },
] as const;

const legacyTabs = [
  { path: "/overview", label: "Overview" },
  { path: "/map", label: "Map" },
  { path: "/coas", label: "COAs" },
  { path: "/causal", label: "Causal" },
  { path: "/realism", label: "Realism" },
  { path: "/evaluation", label: "Evaluation" },
  { path: "/modules", label: "Modules" },
  { path: "/runs", label: "Runs" },
  { path: "/cosim", label: "Co-Sim" },
  { path: "/replay-3d", label: "3D Replay" },
] as const;

const routeLabels: Record<string, string> = Object.fromEntries([
  ...studioTabs.map((tab) => [tab.path, tab.label]),
  ...legacyTabs.map((tab) => [tab.path, tab.label]),
]);

const demoModes = [
  { id: "policy_auto", label: "Autoplay", help: "Policy auto-approves supported COAs" },
  { id: "explicit_approvals", label: "Explicit", help: "COAs require explicit approved action tokens" },
  { id: "human_hold", label: "Review Holds", help: "Pause at review holds for human action" },
] as const;

function formatUtcClock(now: Date) {
  const time = now.toISOString().slice(11, 19);
  const day = now.getUTCDate().toString().padStart(2, "0");
  const month = now.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
  const year = now.getUTCFullYear();
  return { time: `${time}Z`, date: `${day} ${month} ${year}` };
}

export default function TopNav() {
  const { pathname } = useLocation();
  const { scenario, seed, setScenario, runSimulation, status, authorizationMode, setAuthorizationMode } =
    useSimulation();
  const scenarioMeta = SCENARIOS.find((s) => s.id === scenario) ?? SCENARIOS[0];
  const currentLabel = useMemo(() => routeLabels[pathname] ?? "Mission", [pathname]);
  const [clock, setClock] = useState(formatUtcClock(new Date()));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const legacyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setClock(formatUtcClock(new Date())), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!settingsOpen && !legacyOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (settingsRef.current && !settingsRef.current.contains(target)) setSettingsOpen(false);
      if (legacyRef.current && !legacyRef.current.contains(target)) setLegacyOpen(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [settingsOpen, legacyOpen]);

  return (
    <header className="shrink-0 border-b border-darla-border bg-darla-bg">
      <div className="flex h-12 items-center justify-between px-5">
        <div className="flex items-center gap-7">
          <div className="flex flex-col leading-none">
            <span className="text-lg font-bold tracking-tight text-darla-text">DARLA</span>
            <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-darla-text-muted">
              Studio v2
            </span>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {studioTabs.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                title={tab.help}
                className={({ isActive }) =>
                  `relative px-3 py-2 text-[13px] font-medium transition-colors ${
                    isActive
                      ? "text-darla-text after:absolute after:inset-x-2 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-darla-blue"
                      : "text-darla-text-muted hover:text-darla-text-secondary"
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}

            <div ref={legacyRef} className="relative">
              <button
                type="button"
                className="ml-1 rounded-md px-2 py-1 text-[11px] text-darla-text-muted hover:bg-darla-panel hover:text-darla-text-secondary"
                onClick={() => setLegacyOpen((open) => !open)}
              >
                Legacy views
              </button>
              {legacyOpen ? (
                <div className="absolute left-0 top-full z-50 mt-2 grid min-w-[170px] gap-1 rounded-lg border border-darla-border bg-darla-panel p-1 shadow-xl">
                  {legacyTabs.map((tab) => (
                    <NavLink
                      key={tab.path}
                      to={tab.path}
                      className="rounded-md px-3 py-2 text-[12px] text-darla-text-muted hover:bg-darla-panel-elevated hover:text-darla-text"
                      onClick={() => setLegacyOpen(false)}
                    >
                      {tab.label}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right font-mono text-[11px] text-darla-text-muted lg:block">
            <div>{clock.time}</div>
            <div>{clock.date}</div>
          </div>
          <button type="button" className="rounded-lg p-2 text-darla-text-muted hover:bg-darla-panel hover:text-darla-text">
            <Bell size={16} />
          </button>
          <div ref={settingsRef} className="relative">
            <button
              type="button"
              className="rounded-lg p-2 text-darla-text-muted hover:bg-darla-panel hover:text-darla-text"
              aria-expanded={settingsOpen}
              aria-haspopup="menu"
              onClick={() => setSettingsOpen((open) => !open)}
            >
              <Settings size={16} />
            </button>
            {settingsOpen ? (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-darla-border bg-darla-panel py-1 shadow-xl">
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-[12px] text-darla-text-secondary hover:bg-darla-panel-elevated hover:text-darla-text"
                  onClick={() => {
                    resetPanelLayoutsToDefaults();
                    setSettingsOpen(false);
                  }}
                >
                  Reset panel layout
                </button>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-darla-border bg-darla-panel py-1 pl-1 pr-2"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-darla-blue/20 text-[11px] font-semibold text-darla-blue">
              PC
            </span>
            <ChevronDown size={14} className="text-darla-text-muted" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-darla-border/60 px-5 py-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-darla-text-muted">
          <span>Scenario</span>
          <span>/</span>
          <select
            className="darla-select py-1 text-darla-text"
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
          >
            {SCENARIOS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <span>/</span>
          <span className="text-darla-text-secondary">{currentLabel}</span>
          <span className="hidden md:inline">/</span>
          <span className="hidden md:inline text-darla-text-muted">
            Mission · Reason · Decide · Build · Replay
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden text-[11px] text-darla-text-muted xl:inline">
            {scenarioMeta.subtitle} · seed {seed}
          </span>
          <div
            className="flex items-center gap-1.5 text-[11px] text-darla-text-muted"
            title="Mode selection is explicit: click a mode, then Run Simulation to start the next run with that authorization policy."
          >
            <span>Mode</span>
            <div role="group" aria-label="Demo authorization mode" className="flex overflow-hidden rounded-lg border border-darla-border bg-darla-panel">
              {demoModes.map((mode) => {
                const active = authorizationMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    title={mode.help}
                    aria-pressed={active}
                    onClick={() => setAuthorizationMode(mode.id)}
                    className={`border-r border-darla-border px-2.5 py-1 text-[11px] transition-colors last:border-r-0 ${
                      active
                        ? "bg-darla-blue/20 text-darla-blue ring-1 ring-inset ring-darla-blue/40"
                        : "text-darla-text-muted hover:bg-darla-panel-elevated hover:text-darla-text-secondary"
                    }`}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            className="darla-btn darla-btn-primary py-1.5"
            disabled={status === "loading"}
            onClick={runSimulation}
          >
            {status === "loading" ? "Starting…" : status === "live" ? "Restart Run" : "Run Simulation"}
          </button>
        </div>
      </div>
    </header>
  );
}
