import type {
  CoSimLogEntry,
  CoSimModel,
  ExecutionGraphEdge,
  ExecutionGraphNode,
  ScriptTab,
  VariableBinding,
} from "../types/cosimStudio";
import type { DashboardData, FmuConfigExport, PythonScriptExport, SimEvent } from "../types";

function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

function inferVariableType(worldPath: string): string {
  if (worldPath.includes("degraded") || worldPath.includes("jammed")) return "bool";
  return "float";
}

function bindingsFromConfig(config: FmuConfigExport): VariableBinding[] {
  const inputs = config.inputs.map((input) => ({
    variable: input.port,
    direction: "input" as const,
    binding: input.world_path,
  }));
  const outputs = config.outputs.map((output) => ({
    variable: output.port,
    direction: "output" as const,
    binding: output.world_path,
  }));
  return [...inputs, ...outputs];
}

export function buildCoSimModelsFromDashboard(dashboard: DashboardData | null): CoSimModel[] {
  const configs = dashboard?.fmu_configs ?? [];
  const scripts = dashboard?.python_scripts ?? [];
  if (configs.length === 0 && scripts.length === 0) return [];

  const runtimeById = new Map((dashboard?.fmu_runtime ?? []).map((runtime) => [runtime.id, runtime]));

  const fmuModels = configs.map((config) => {
    const runtime = runtimeById.get(config.id);
    const inputWorldPaths = new Map(config.inputs.map((input) => [input.port, input.world_path]));
    const outputWorldPaths = new Map(config.outputs.map((output) => [output.port, output.world_path]));

    return {
      id: config.id,
      name: config.id,
      filename: basename(config.path),
      category: "fmu" as const,
      fmiVersion: runtime?.load_mode.startsWith("fmi_file") ? "2.0/3.0" : "analytical",
      interfaceType: "Co-Simulation" as const,
      stepSize: `${config.step_size} sec`,
      inputs: config.inputs.map((input) => ({
        name: input.port,
        type: inferVariableType(input.world_path),
      })),
      outputs: config.outputs.map((output) => ({
        name: output.port,
        type: inferVariableType(output.world_path),
      })),
      bindings: bindingsFromConfig(config),
      validationState: runtime?.initialized ? ("validated" as const) : ("pending" as const),
      status: "ready" as const,
      description: `Scenario-bound co-simulation model (${config.id})`,
      loadMode: runtime?.load_mode ?? "analytical_stub",
      lastStepTime: runtime?.last_step_time,
      liveInputs: runtime?.inputs.map((input) => ({
        port: input.port,
        value: input.value,
        worldPath: inputWorldPaths.get(input.port),
      })),
      liveOutputs: runtime?.outputs.map((output) => ({
        port: output.port,
        value: output.value,
        worldPath: outputWorldPaths.get(output.port),
      })),
    };
  });

  const scriptModels = scripts.map((script) => ({
    id: script.script_id,
    name: `Python Script: ${script.class_name}`,
    filename: basename(script.script_path),
    category: "python_script" as const,
    interfaceType: "Scheduled Execution" as const,
    inputs: [
      { name: "ctx", type: "darla.Context" },
      ...Object.keys(script.params).map((key) => ({ name: `param.${key}`, type: "param" })),
    ],
    outputs: [
      { name: "events", type: "ledger" },
      { name: "coas", type: "recommendation" },
      { name: "scheduled_actions", type: "command" },
    ],
    bindings: [
      { variable: "self", direction: "input" as const, binding: script.object_id },
      { variable: "event_ledger", direction: "output" as const, binding: "EventLedger" },
      { variable: "coa_log", direction: "output" as const, binding: "WorldState.coa_log" },
    ],
    validationState: script.loaded ? ("validated" as const) : script.last_error ? ("failed" as const) : ("pending" as const),
    status: script.enabled ? (script.last_error ? ("error" as const) : ("ready" as const)) : ("loading" as const),
    description: `Unity-style script component attached to ${script.object_id}`,
    loadMode: script.last_reload_status,
    lastStepTime: script.last_tick,
  }));

  return [...fmuModels, ...scriptModels];
}

export function buildBindingsYaml(configs: FmuConfigExport[]): string {
  if (configs.length === 0) {
    return "# No FMU bindings in current scenario\nfmus: {}\n";
  }

  const lines = ["# FMU variable bindings (from scenario YAML)", "fmus:"];
  for (const config of configs) {
    lines.push(`  ${config.id}:`);
    lines.push(`    file: ${basename(config.path)}`);
    lines.push(`    step_size: ${config.step_size}`);
    if (config.inputs.length > 0) {
      lines.push("    inputs:");
      for (const input of config.inputs) {
        lines.push(`      ${input.port}: ${input.world_path}`);
      }
    }
    if (config.outputs.length > 0) {
      lines.push("    outputs:");
      for (const output of config.outputs) {
        lines.push(`      ${output.port}: ${output.world_path}`);
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

export function buildScriptTabsFromDashboard(dashboard: DashboardData | null): ScriptTab[] {
  const configs = dashboard?.fmu_configs ?? [];
  const scripts = dashboard?.python_scripts ?? [];
  const bindingsYaml = buildBindingsYaml(configs);
  const scriptTabs = scripts.map((script) => ({
    id: script.script_id,
    filename: basename(script.script_path),
    language: "python" as const,
    content: buildPythonScriptStub(script),
    readOnly: false,
    status: script.last_reload_status,
    error: script.last_error,
  }));

  const orchestrationLines = [
    "# Auto-generated from scenario FMU configs",
    "from darla import scenario, fmu",
    "",
  ];
  for (const config of configs) {
    orchestrationLines.push(
      `${config.id} = fmu.load("${basename(config.path)}", name="${config.id}", step_size=${config.step_size})`,
    );
    for (const input of config.inputs) {
      orchestrationLines.push(`${config.id}.bind_input("${input.port}", "${input.world_path}")`);
    }
    for (const output of config.outputs) {
      orchestrationLines.push(`${config.id}.bind_output("${output.port}", "${output.world_path}")`);
    }
    orchestrationLines.push("");
  }
  orchestrationLines.push("@scenario.on_tick");
  orchestrationLines.push("def step_fmus(t):");
  if (configs.length === 0) {
    orchestrationLines.push("    pass  # no FMUs configured");
  } else {
    for (const config of configs) {
      orchestrationLines.push(`    ${config.id}.step(t)`);
    }
  }

  return [
    ...scriptTabs,
    {
      id: "orchestration",
      filename: "fmu_orchestration.py",
      language: "python",
      content: `${orchestrationLines.join("\n")}\n`,
    },
    {
      id: "bindings",
      filename: "bindings.yaml",
      language: "yaml",
      content: bindingsYaml,
    },
    {
      id: "scenario",
      filename: "scenario_meta.json",
      language: "json",
      content: JSON.stringify(
        {
          scenario_id: dashboard?.scenario_id ?? "unknown",
          seed: dashboard?.seed ?? 0,
          max_ticks: dashboard?.max_ticks ?? 0,
          fmu_count: configs.length,
          python_script_count: scripts.length,
          co_sim_master: "darla",
        },
        null,
        2,
      ),
    },
  ];
}

export function buildExecutionGraphFromDashboard(
  dashboard: DashboardData | null,
): { nodes: ExecutionGraphNode[]; edges: ExecutionGraphEdge[] } {
  const configs = dashboard?.fmu_configs ?? [];
  const scripts = dashboard?.python_scripts ?? [];
  if (configs.length === 0 && scripts.length === 0) {
    return { nodes: [], edges: [] };
  }

  const nodes: ExecutionGraphNode[] = [];
  const edges: ExecutionGraphEdge[] = [];
  const fmuSpacing = 160;
  const startX = 40;

  configs.forEach((config, index) => {
    nodes.push({
      id: config.id,
      label: basename(config.path),
      type: "fmu",
      x: startX + index * fmuSpacing,
      y: 30,
    });
  });

  scripts.forEach((script, index) => {
    nodes.push({
      id: script.script_id,
      label: script.class_name,
      type: "python_script",
      x: startX + (configs.length + index) * fmuSpacing,
      y: 30,
    });
  });

  const busX = startX + (configs.length + scripts.length) * fmuSpacing;
  nodes.push({ id: "darla-bus", label: "DARLA Event Bus", type: "bus", x: busX, y: 30 });
  nodes.push({ id: "causal", label: "Causal Graph", type: "causal", x: busX + 160, y: 30 });
  nodes.push({ id: "coa", label: "COA Scorer", type: "coa", x: busX + 320, y: 30 });

  for (const config of configs) {
    edges.push({ from: config.id, to: "darla-bus" });
  }
  for (const script of scripts) {
    const entityNodeId = script.object_id;
    if (!nodes.some((node) => node.id === entityNodeId)) {
      nodes.push({
        id: entityNodeId,
        label: script.object_id,
        type: "native",
        x: startX,
        y: 110 + nodes.filter((node) => node.type === "native").length * 48,
      });
    }
    edges.push({ from: script.object_id, to: script.script_id, label: "ctx.self" });
    edges.push({ from: script.script_id, to: "darla-bus", label: "commands" });
  }
  edges.push({ from: "darla-bus", to: "causal" });
  edges.push({ from: "causal", to: "coa", label: "score" });

  for (const config of configs) {
    for (const input of config.inputs) {
      const entityId = input.world_path.split(".")[0];
      if (!entityId) continue;
      const entityNodeId = `entity-${entityId}`;
      if (!nodes.some((node) => node.id === entityNodeId)) {
        nodes.push({
          id: entityNodeId,
          label: entityId,
          type: "native",
          x: startX,
          y: 110 + nodes.filter((node) => node.type === "native").length * 48,
        });
      }
      edges.push({ from: entityNodeId, to: config.id, label: input.port });
    }
  }

  return { nodes, edges };
}

function levelForEvent(event: SimEvent): CoSimLogEntry["level"] {
  if (event.label.startsWith("fmu_step:")) return "success";
  if (event.confidence < 0.5) return "warn";
  return "info";
}

export function buildCoSimLogsFromDashboard(
  dashboard: DashboardData | null,
  currentTick: number,
  maxEntries = 40,
): CoSimLogEntry[] {
  if (!dashboard) return [];

  const logs: CoSimLogEntry[] = [];
  const configs = dashboard.fmu_configs ?? [];
  const scripts = dashboard.python_scripts ?? [];

  if (configs.length > 0) {
    logs.push({
      id: "init",
      timestamp: "t=0",
      level: "info",
      message: `Co-sim master loaded ${configs.length} FMU config(s) from scenario ${dashboard.scenario_id}`,
    });
    for (const config of configs) {
      logs.push({
        id: `load-${config.id}`,
        timestamp: "t=0",
        level: "info",
        message: `Configured FMU ${config.id} → ${basename(config.path)} (step ${config.step_size}s)`,
      });
    }
  }

  if (scripts.length > 0) {
    logs.push({
      id: "scripts-init",
      timestamp: "t=0",
      level: "info",
      message: `Loaded ${scripts.length} Python script component(s) from scenario ${dashboard.scenario_id}`,
    });
    for (const script of scripts) {
      logs.push({
        id: `script-${script.script_id}`,
        timestamp: `t=${script.last_tick}`,
        level: script.last_error ? "error" : script.loaded ? "success" : "warn",
        message: `${script.object_id}.${script.class_name} status=${script.last_reload_status}; events=${script.emitted_events}; coas=${script.proposed_coas}`,
      });
      if (script.last_error) {
        logs.push({
          id: `script-error-${script.script_id}`,
          timestamp: `t=${script.last_tick}`,
          level: "error",
          message: script.last_error,
        });
      }
    }
  }

  if (configs.length === 0 && scripts.length === 0) {
    logs.push({
      id: "empty",
      timestamp: "t=0",
      level: "warn",
      message: "No fmus: or python_script components in the active scenario",
    });
  }

  const fmuEvents = dashboard.events
    .filter((event) => event.tick <= currentTick && event.label.startsWith("fmu_step:"))
    .slice(-maxEntries);

  for (const event of fmuEvents) {
    const deltaSummary =
      event.deltas.length > 0
        ? event.deltas.map((delta) => `${delta.field}: ${delta.before} → ${delta.after}`).join("; ")
        : event.provenance || event.label;
    logs.push({
      id: `evt-${event.event_id}`,
      timestamp: `t=${event.tick}`,
      level: levelForEvent(event),
      message: deltaSummary,
    });
  }

  return logs.slice(-maxEntries);
}

export function defaultSelectedFmuId(dashboard: DashboardData | null): string | null {
  return dashboard?.fmu_configs?.[0]?.id ?? dashboard?.python_scripts?.[0]?.script_id ?? null;
}

function buildPythonScriptStub(script: PythonScriptExport): string {
  const params = JSON.stringify(script.params, null, 4)
    .split("\n")
    .map((line) => `# ${line}`)
    .join("\n");
  return [
    `# ${script.script_path}`,
    `# Attached object: ${script.object_id}`,
    `# Runtime status: ${script.last_reload_status || "not_loaded"}`,
    params ? `# Params:\n${params}` : "# Params: {}",
    "",
    `class ${script.class_name}:`,
    "    def __init__(self, params):",
    "        self.params = params",
    "",
    "    def on_init(self, ctx):",
    "        ctx.log(\"script initialized\")",
    "",
    "    def on_tick(self, ctx, dt):",
    "        # Use ctx.get(...), ctx.emit_event(...), ctx.propose_coa(...), ctx.schedule_action(...)",
    "        pass",
    "",
  ].join("\n");
}
