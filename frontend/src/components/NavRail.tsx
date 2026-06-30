import type { ComponentType } from "react";
import {
  BarChart3,
  Box,
  Boxes,
  Cpu,
  GitBranch,
  History,
  LayoutDashboard,
  Map,
  Network,
  ShieldCheck,
  Share2,
} from "lucide-react";
import { NavLink } from "react-router-dom";

type NavItem = {
  path: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  beta?: boolean;
};

const primaryNavItems: NavItem[] = [
  { path: "/mission", label: "Mission", icon: LayoutDashboard },
  { path: "/reason", label: "Reason", icon: Share2 },
  { path: "/decide", label: "Decide", icon: GitBranch },
  { path: "/build", label: "Build", icon: Boxes },
  { path: "/replay", label: "Replay", icon: History },
  { path: "/validation", label: "Validation", icon: ShieldCheck },
];

const secondaryNavItems: NavItem[] = [
  { path: "/map", label: "Map", icon: Map },
  { path: "/modules", label: "Modules", icon: Cpu },
  { path: "/causal", label: "Legacy Causal", icon: Network },
  { path: "/runs", label: "Runs", icon: BarChart3 },
  { path: "/replay-3d", label: "3D Replay", icon: Box, beta: true },
];

export default function NavRail() {
  return (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-darla-border bg-darla-bg py-3">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-darla-blue text-xs font-bold text-white">
        D
      </div>

      {primaryNavItems.map((item) => (
        <RailLink key={item.path} item={item} />
      ))}

      <div className="my-2 h-px w-7 bg-darla-border" />

      {secondaryNavItems.map((item) => (
        <RailLink key={item.path} item={item} />
      ))}
    </nav>
  );
}

function RailLink({ item }: { item: NavItem }) {
  const Icon = item.icon;

  return (
    <NavLink
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
      <Icon size={18} strokeWidth={1.75} />
      {item.beta ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-darla-blue" /> : null}
    </NavLink>
  );
}

export const navItems = [...primaryNavItems, ...secondaryNavItems];
