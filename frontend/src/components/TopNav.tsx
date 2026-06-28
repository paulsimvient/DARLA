import { Bell, ChevronDown, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { SCENARIOS, useSimulation } from "../context/SimulationContext";
import { resetPanelLayoutsToDefaults } from "../utils/layoutStorage";

const tabs = [
  { path: "/overview", label: "Overview" },
  { path: "/map", label: "Map" },
  { path: "/coas", label: "COAs" },
  { path: "/causal", label: "Causal" },
  { path: "/modules", label: "Modules" },
  { path: "/runs", label: "Runs" },
  { path: "/replay-3d", label: "3D Replay" },
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
  const humanHoldEnabled = authorizationMode === "human_hold";
  const scenarioMeta = SCENARIOS.find((s) => s.id === scenario) ?? SCENARIOS[0];
  const currentTab = tabs.find((t) => t.path === pathname) ?? tabs[0];
  const [clock, setClock] = useState(formatUtcClock(new Date()));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setClock(formatUtcClock(new Date())), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [settingsOpen]);

  return (
    <header className="shrink-0 border-b border-darla-border bg-darla-bg">
      <div className="flex h-12 items-center justify-between px-5">
        <div className="flex items-center gap-8">
          <span className="text-lg font-bold tracking-tight text-darla-text">DARLA</span>
          <nav className="hidden items-center gap-1 md:flex">
            {tabs.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={({ isActive }) =>
                  `relative px-3 py-2 text-[13px] font-medium transition-colors ${
                    isActive
                      ? "text-darla-text after:absolute after:inset-x-2 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-darla-blue"
                      : "text-darla-text-muted hover:text-darla-text-secondary"
                  }`
                }
              >
                {tab.label}
                {"beta" in tab && tab.beta ? (
                  <span className="ml-1 text-[10px] font-normal text-darla-text-muted">(Beta)</span>
                ) : null}
              </NavLink>
            ))}
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
              JS
            </span>
            <ChevronDown size={14} className="text-darla-text-muted" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-darla-border/60 px-5 py-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-darla-text-muted">
          <span>Scenarios</span>
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
          <span className="text-darla-text-secondary">{currentTab.label}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-darla-text-muted">
            {scenarioMeta.subtitle} · seed {seed}
          </span>
          <label
            className="flex cursor-pointer items-center gap-1.5 text-[11px] text-darla-text-muted"
            title={
              status === "loading" || status === "live"
                ? "Authorization mode is fixed for the active run. Stop or wait for completion, then change before the next run."
                : "When checked, COA reviews pause for human approval. When unchecked, supported COAs auto-execute under policy_auto."
            }
          >
            <input
              type="checkbox"
              className="accent-blue-500"
              checked={humanHoldEnabled}
              disabled={status === "loading" || status === "live"}
              onChange={(event) =>
                setAuthorizationMode(event.target.checked ? "human_hold" : "policy_auto")
              }
            />
            Human hold
          </label>
          <button
            type="button"
            className="darla-btn darla-btn-primary py-1.5"
            disabled={status === "loading" || status === "live"}
            onClick={runSimulation}
          >
            {status === "loading" || status === "live" ? "Running…" : "Run Simulation"}
          </button>
        </div>
      </div>
    </header>
  );
}
