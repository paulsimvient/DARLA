import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Box,
  Cpu,
  Crosshair,
  Database,
  Globe,
  Layers,
  Network,
  Radio,
  Server,
  Shield,
  Swords,
  Target,
  Users,
  Zap,
} from "lucide-react";
import type { ModuleCategory, SimModule } from "../../data/mockScenario";

/** Thin-stroke wireframe icon defaults */
export const wireframeProps = {
  size: 18,
  strokeWidth: 1.25,
  fill: "none" as const,
};

export const categoryIcons: Record<ModuleCategory, LucideIcon> = {
  "Force Entity": Users,
  "Weapon System": Crosshair,
  "Sensor System": Radio,
  "Command & Control": Network,
  "Cyber Capability": Shield,
  "Environment": Globe,
  "Infrastructure": Server,
  "Behavior Model": Activity,
  "Event / Trigger": Zap,
  "Data Feed": Database,
};

export function iconForCategory(category: ModuleCategory): LucideIcon {
  return categoryIcons[category] ?? Box;
}

export function iconForModule(module: SimModule): LucideIcon {
  if (module.type.toLowerCase().includes("weapon") || module.type.toLowerCase().includes("kinetic")) {
    return Swords;
  }
  if (module.type.toLowerCase().includes("target") || module.name.toLowerCase().includes("recon")) {
    return Target;
  }
  if (module.type.toLowerCase().includes("link") || module.category === "Data Feed") {
    return Layers;
  }
  if (module.type.toLowerCase().includes("cyber")) {
    return Cpu;
  }
  return iconForCategory(module.category);
}

type ModuleWireframeIconProps = {
  module: SimModule;
  size?: number;
  className?: string;
};

export function ModuleWireframeIcon({ module, size = 18, className = "" }: ModuleWireframeIconProps) {
  const Icon = iconForModule(module);
  return <Icon size={size} strokeWidth={1.25} fill="none" className={className} />;
}

type CategoryWireframeIconProps = {
  category: ModuleCategory;
  size?: number;
  className?: string;
};

export function CategoryWireframeIcon({ category, size = 16, className = "" }: CategoryWireframeIconProps) {
  const Icon = iconForCategory(category);
  return <Icon size={size} strokeWidth={1.25} fill="none" className={className} />;
}
