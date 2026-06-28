import type { LucideIcon } from "lucide-react";
import { Activity, Crosshair, Flag, Radio, Shield, Zap } from "lucide-react";
import type { CausalNodeType } from "../../data/causalModel";

export const causalTypeIcons: Record<CausalNodeType, LucideIcon> = {
  signal: Radio,
  inference: Activity,
  state: Shield,
  action: Zap,
  effect: Crosshair,
  outcome: Flag,
};

type CausalWireframeIconProps = {
  type: CausalNodeType;
  size?: number;
  className?: string;
};

export function CausalWireframeIcon({ type, size = 16, className = "" }: CausalWireframeIconProps) {
  const Icon = causalTypeIcons[type];
  return <Icon size={size} strokeWidth={1.25} fill="none" className={className} />;
}
