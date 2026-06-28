/** CoSim Studio UI types — backed by dashboard export, not mock fixtures. */

export type FMIInterfaceType = "Co-Simulation" | "Model Exchange" | "Scheduled Execution";

export type ValidationState = "validated" | "pending" | "failed" | "draft";

export type ModelLibraryCategory = "fmu" | "native" | "agent" | "data_feed" | "python_script";

export type VariableBinding = {
  variable: string;
  direction: "input" | "output";
  binding: string;
};

export type FMUVariable = {
  name: string;
  type: string;
  unit?: string;
  description?: string;
};

export type CoSimModel = {
  id: string;
  name: string;
  filename?: string;
  category: ModelLibraryCategory;
  fmiVersion?: string;
  interfaceType?: FMIInterfaceType;
  stepSize?: string;
  inputs: FMUVariable[];
  outputs: FMUVariable[];
  bindings: VariableBinding[];
  validationState: ValidationState;
  status: "ready" | "loading" | "error";
  description?: string;
  loadMode?: string;
  lastStepTime?: number;
  liveInputs?: { port: string; value: number; worldPath?: string }[];
  liveOutputs?: { port: string; value: number; worldPath?: string }[];
};

export type ScriptTab = {
  id: string;
  filename: string;
  language: "python" | "yaml" | "json" | "darla";
  content: string;
  readOnly?: boolean;
  status?: string;
  error?: string;
};

export type ExecutionGraphNode = {
  id: string;
  label: string;
  type: "fmu" | "native" | "agent" | "data_feed" | "python_script" | "bus" | "causal" | "coa" | "timeline";
  x: number;
  y: number;
};

export type ExecutionGraphEdge = {
  from: string;
  to: string;
  label?: string;
};

export type CoSimLogEntry = {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "success" | "error";
  message: string;
};
