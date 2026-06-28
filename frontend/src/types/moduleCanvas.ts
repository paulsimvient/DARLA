/** Module canvas types — populated from scenario entities at runtime. */

export type ModuleCategory =
  | "Force Entity"
  | "Weapon System"
  | "Sensor System"
  | "Command & Control"
  | "Cyber Capability"
  | "Environment"
  | "Infrastructure"
  | "Behavior Model"
  | "Event / Trigger"
  | "Data Feed";

export type SimModule = {
  id: string;
  name: string;
  category: ModuleCategory;
  type: string;
  status: "active" | "draft" | "validated";
  updateRate: string;
  range: string;
  detectionProbability: number;
  latency: string;
  confidenceModel: string;
  inputs: string[];
  outputs: string[];
  validationStatus: "pass" | "warn" | "fail";
  x: number;
  y: number;
  connections: string[];
  onCanvas?: boolean;
  description?: string;
  tags?: string[];
};

export const moduleCategories: ModuleCategory[] = [
  "Force Entity",
  "Weapon System",
  "Sensor System",
  "Command & Control",
  "Cyber Capability",
  "Environment",
  "Infrastructure",
  "Behavior Model",
  "Event / Trigger",
  "Data Feed",
];
