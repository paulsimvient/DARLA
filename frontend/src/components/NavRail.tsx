import {
  Box,
  Boxes,
  Cpu,
  GitBranch,
  History,
  LayoutDashboard,
  Map,
  Network,
  Share2,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const navItems = [
  { path: "/overview", label: "Overview", icon: LayoutDashboard },
  { path: "/map", label: "Map", icon: Map },
  { path: "/coas", label: "COAs", icon: GitBranch },
  { path: "/causal", label: "Causal", icon: Share2 },
  { path: "/modules", label: "Modules", icon: Boxes },
  { path: "/runs", label: "Runs", icon: History },
  { path: "/cosim", label: "Co-Sim Studio", icon: Cpu },
  { path: "/replay-3d", label: "3D Replay", icon: Box, beta: true },
] as const;

export default function NavRail() {
  return (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-darla-border bg-darla-bg py-3">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-darla-blue text-xs font-bold text-white">
        D
      </div>
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          title={item.label}
          className={({ isActive }) =>
            `group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
              isActive
                ? "bg-darla-panel-elevated text-darla-blue"
                : "text-darla-text-muted hover:bg-darla-panel hover:text-darla-text-secondary"
            }`
          }
        >
          <item.icon size={18} strokeWidth={1.75} />
          {"beta" in item && item.beta ? (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-darla-blue" />
          ) : null}
        </NavLink>
      ))}
      <div className="mt-auto">
        <NavLink
          to="/causal"
          title="Graph"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-darla-text-muted hover:bg-darla-panel hover:text-darla-text-secondary"
        >
          <Network size={18} strokeWidth={1.75} />
        </NavLink>
      </div>
    </nav>
  );
}

export { navItems };
