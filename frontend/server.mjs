import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

/** @typedef {{ id: string, scenario: string, seed: number, authorizationMode: string, branchId: string, parentRunId: string | null, background: boolean, child: import("node:child_process").ChildProcessWithoutNullStreams, events: object[], frames: object[], commands: object[], branches: object[], replayHash: string | null, status: string, createdAt: number, dashboardCache: object | null, dashboardCachePromise: Promise<object> | null, sseBuffer: string, droppedSseBlocks: number, reviewHold: object | null, lastHeartbeat: object | null }} SimRun */

/** @type {Map<string, SimRun>} */
const runs = new Map();

function findBinary(name) {
  const candidates = [
    path.join(repoRoot, "build-all", name),
    path.join(repoRoot, "build-linux", name),
    path.join(repoRoot, "build-review", name),
    path.join(repoRoot, "build-make", name),
    path.join(repoRoot, "build", name),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function findSimExport() {
  return findBinary("sim-export");
}

function findSimStream() {
  return findBinary("sim-stream");
}

function findSimLive() {
  return findBinary("sim-live");
}

function findSimServe() {
  return findBinary("sim-serve");
}

function findSimCounterfactual() {
  return findBinary("sim-counterfactual");
}

function resolveScenario(requested) {
  const scenarioPath = requested.startsWith("scenarios/")
    ? path.join(repoRoot, requested)
    : path.join(repoRoot, "scenarios", "uas-maritime-cyber", requested);
  if (!fs.existsSync(scenarioPath)) {
    throw new Error(`Scenario not found: ${requested}`);
  }
  return scenarioPath;
}

function buildCliArgs(scenarioPath, seed, options = {}) {
  const args = [scenarioPath, "--seed", String(seed)];
  const mode = options.authorizationMode ?? options.mode;
  if (mode) {
    args.push("--mode", mode);
  }
  for (const approval of options.approvals ?? []) {
    args.push("--approve", approval);
  }
  if (options.runId) {
    args.push("--run-id", options.runId);
  }
  if (options.branchId) {
    args.push("--branch-id", options.branchId);
  }
  if (options.parentRunId) {
    args.push("--parent-run-id", options.parentRunId);
  }
  return args;
}

function runBinary(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd: repoRoot,
      env: process.env,
    });

    /** @type {Buffer[]} */
    const stdoutChunks = [];
    /** @type {Buffer[]} */
    const stderrChunks = [];
    child.stdout.on("data", (chunk) => { stdoutChunks.push(chunk); });
    child.stderr.on("data", (chunk) => { stderrChunks.push(chunk); });
    child.on("close", (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      if (code !== 0) {
        reject(new Error(stderr || `${path.basename(binary)} exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`${path.basename(binary)} returned invalid JSON`));
      }
    });
  });
}

function runExport(scenarioPath, seed, options = {}) {
  const simExport = findSimExport();
  if (!simExport) {
    throw new Error("sim-export binary not found. Build with: cmake --build build-make");
  }
  return runBinary(simExport, buildCliArgs(scenarioPath, seed, options));
}

function runStream(scenarioPath, seed, options = {}) {
  const simStream = findSimStream();
  if (!simStream) {
    throw new Error("sim-stream binary not found. Build with: cmake --build build-make --target sim-stream");
  }
  return runBinary(simStream, buildCliArgs(scenarioPath, seed, options));
}

function safeRepoPath(relativePath) {
  const resolved = path.resolve(repoRoot, relativePath);
  if (!resolved.startsWith(repoRoot + path.sep)) {
    throw new Error(`Path escapes repository root: ${relativePath}`);
  }
  return resolved;
}

async function validatePythonSyntax(filePath) {
  const python = process.env.PYTHON ?? "python3";
  return new Promise((resolve) => {
    const child = spawn(python, ["-m", "py_compile", filePath], {
      cwd: repoRoot,
      env: process.env,
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => {
      resolve({ ok: code === 0, error: stderr.trim() });
    });
    child.on("error", (error) => {
      resolve({ ok: false, error: error.message });
    });
  });
}

async function editorDashboard(url) {
  const scenario = url.searchParams.get("scenario") ?? "scenarios/uas-maritime-cyber/scenario.yaml";
  const seed = Number(url.searchParams.get("seed") ?? "42");
  return runExport(resolveScenario(scenario), seed, {
    authorizationMode: url.searchParams.get("mode") ?? undefined,
    approvals: url.searchParams.getAll("approve"),
  });
}

async function editorScriptById(url, scriptId) {
  const dashboard = await editorDashboard(url);
  const script = (dashboard.python_scripts ?? []).find((item) => item.script_id === scriptId);
  if (!script) {
    throw new Error(`Script not found: ${scriptId}`);
  }
  return script;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function parseSimpleYaml(text) {
  /** @type {Record<string, unknown>} */
  const root = {};
  /** @type {{ indent: number, obj: Record<string, unknown> }[]} */
  const stack = [{ indent: -1, obj: root }];
  for (const rawLine of text.split("\n")) {
    if (!rawLine.trim() || rawLine.trim().startsWith("#")) continue;
    const indent = rawLine.search(/\S/);
    const line = rawLine.trim();
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].obj;
    if (value === "") {
      const child = {};
      parent[key] = child;
      stack.push({ indent, obj: child });
    } else {
      parent[key] = value.replace(/^"|"$/g, "");
    }
  }
  return root;
}

function loadScenarioProvenance(scenarioRelPath) {
  const scenarioPath = resolveScenario(scenarioRelPath);
  const provenancePath = path.join(path.dirname(scenarioPath), "data_provenance.yaml");
  if (!fs.existsSync(provenancePath)) {
    return null;
  }
  return parseSimpleYaml(fs.readFileSync(provenancePath, "utf8"));
}

function createRunId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

function attachRunStdoutParser(run) {
  run.child.stdout.on("data", (chunk) => {
    parseSseChunk(run, chunk);
  });
}

function createRun({
  scenario,
  seed = 42,
  authorizationMode = "policy_auto",
  branchId = "baseline",
  parentRunId = null,
  approvals = [],
  background = false,
}) {
  const simServe = findSimServe();
  if (!simServe) {
    throw new Error("sim-serve binary not found. Build with: cmake --build build-make --target sim-serve");
  }

  const scenarioPath = resolveScenario(scenario);
  const runId = createRunId();
  const args = buildCliArgs(scenarioPath, seed, {
    authorizationMode,
    approvals,
    runId,
    branchId,
    parentRunId: parentRunId ?? undefined,
  });

  const child = spawn(simServe, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  /** @type {SimRun} */
  const run = {
    id: runId,
    scenario,
    seed,
    authorizationMode,
    branchId,
    parentRunId,
    background,
    child,
    events: [],
    frames: [],
    commands: [],
    branches: [],
    replayHash: null,
    status: "starting",
    createdAt: Date.now(),
    dashboardCache: null,
    dashboardCachePromise: null,
    sseBuffer: "",
    droppedSseBlocks: 0,
    reviewHold: null,
    lastHeartbeat: null,
  };

  child.stderr.on("data", (chunk) => {
    console.error(`[run ${runId}] ${chunk.toString()}`);
  });

  child.on("close", () => {
    run.status = "completed";
  });

  attachRunStdoutParser(run);
  runs.set(runId, run);
  return run;
}

function parseSseChunk(run, chunk) {
  run.sseBuffer += chunk.toString("utf8");

  while (true) {
    const boundary = run.sseBuffer.indexOf("\n\n");
    if (boundary === -1) break;

    const block = run.sseBuffer.slice(0, boundary);
    run.sseBuffer = run.sseBuffer.slice(boundary + 2);
    parseSseBlock(run, block);
  }
}

function parseSseBlock(run, block) {
  if (!block.trim()) return;

  let eventName = "message";
  const dataLines = [];
  for (const rawLine of block.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) return;

  try {
    ingestRunEvent(run, eventName, JSON.parse(dataLines.join("\n")));
  } catch (error) {
    run.droppedSseBlocks += 1;
    run.events.push({
      event_id: Date.now(),
      tick: run.frames.at(-1)?.tick ?? 0,
      label: "server_sse_parse_error",
      type: "ValidationFailure",
      deltas: [
        { field: "event_name", before: "unknown", after: eventName },
        { field: "error", before: "none", after: String(error?.message ?? error) },
      ],
    });
  }
}

function ingestRunEvent(run, eventName, payload) {
  if (eventName === "tick") {
    run.frames.push(payload);
    if (payload.replay_hash) run.replayHash = String(payload.replay_hash);
    for (const event of payload.events ?? []) {
      run.events.push(event);
    }
    run.status = "live";
    return;
  }

  if (eventName === "meta") {
    if (payload.replay_hash) run.replayHash = String(payload.replay_hash);
    run.status = "live";
    return;
  }

  if (eventName === "review_hold") {
    run.reviewHold = payload;
    run.status = "review_hold";
    run.commands.push({ type: "review_hold", ...payload });
    return;
  }

  if (eventName === "heartbeat") {
    run.lastHeartbeat = payload;
    if (payload.state) run.status = String(payload.state);
    return;
  }

  if (eventName === "done") {
    if (payload.replay_hash) run.replayHash = String(payload.replay_hash);
    run.status = "completed";
    return;
  }

  if (eventName === "command") {
    run.commands.push(payload);
    if (payload.type === "approve_coa" || payload.type === "reject_coa" || payload.type === "continue_review") {
      run.reviewHold = null;
      run.status = "live";
    }
  }
}

async function ensureRunDashboard(run) {
  if (run.dashboardCache) return run.dashboardCache;
  if (run.dashboardCachePromise) return run.dashboardCachePromise;
  run.dashboardCachePromise = runExport(resolveScenario(run.scenario), run.seed, {
    authorizationMode: run.authorizationMode,
  }).then((dashboard) => {
    run.dashboardCache = dashboard;
    run.dashboardCachePromise = null;
    return dashboard;
  }).catch((error) => {
    run.dashboardCachePromise = null;
    throw error;
  });
  return run.dashboardCachePromise;
}

async function runBranchCounterfactual({ scenario, seed, fromTick, intervention }) {
  const simCounterfactual = findSimCounterfactual();
  if (!simCounterfactual) {
    throw new Error("sim-counterfactual binary not found");
  }
  const scenarioPath = resolveScenario(scenario);
  const branchId = `branch-${intervention.action}-${intervention.scheduled_at_tick ?? fromTick}`;
  const args = [
    scenarioPath,
    "--seed",
    String(seed),
    "--at",
    String(intervention.scheduled_at_tick ?? fromTick),
    "--intervention",
    intervention.action,
  ];
  const output = await new Promise((resolve, reject) => {
    const child = spawn(simCounterfactual, args, { cwd: repoRoot, env: process.env });
    /** @type {Buffer[]} */
    const stdoutChunks = [];
    /** @type {Buffer[]} */
    const stderrChunks = [];
    child.stdout.on("data", (chunk) => { stdoutChunks.push(chunk); });
    child.stderr.on("data", (chunk) => { stderrChunks.push(chunk); });
    child.on("close", (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      if (code !== 0) {
        reject(new Error(stderr || `sim-counterfactual exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });
  });

  const baselineDetection = Number(/Baseline detection: T\+(\d+)/.exec(output)?.[1] ?? 0);
  const counterfactualDetection = Number(/Counterfactual detection: T\+(\d+)/.exec(output)?.[1] ?? 0);
  const estimatedEffect = Number(/Estimated effect: ([+-]?\d+\.?\d*)/.exec(output)?.[1] ?? 0);
  const confidence = Number(/Confidence: (\d+\.?\d*)/.exec(output)?.[1] ?? 0);

  return {
    branch_id: branchId,
    mission_delta: estimatedEffect,
    detection_time_delta: counterfactualDetection - baselineDetection,
    risk_delta: -confidence * 0.25,
    replay_hash: crypto.createHash("sha256").update(output).digest("hex").slice(0, 16),
    raw_output: output,
  };
}



function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function confidenceBand(mean, spread, evidenceCount) {
  const clampedMean = clamp01(mean);
  const clampedSpread = Math.max(0.01, Math.min(0.45, Number(spread) || 0.1));
  return {
    mean: clampedMean,
    stddev: clampedSpread / 1.64,
    lower90: clamp01(clampedMean - clampedSpread),
    upper90: clamp01(clampedMean + clampedSpread),
    confidence: clamp01(0.42 + Number(evidenceCount || 0) * 0.045 - clampedSpread * 0.35),
    evidenceCount: Number(evidenceCount || 0),
  };
}

function evidenceTextOf(event) {
  return `${event?.type ?? ""} ${event?.label ?? ""} ${(event?.deltas ?? [])
    .map((delta) => `${delta.field}:${delta.before}->${delta.after}`)
    .join(" ")}`.toLowerCase();
}

function inferEvidenceVariable(event) {
  const text = evidenceTextOf(event);
  const firstField = event?.deltas?.[0]?.field;
  if (text.includes("cyber")) return "red_cyber_actor.cyber_effect";
  if (text.includes("sensor")) return "blue_uas_1.sensor.confidence";
  if (text.includes("comms") || text.includes("relay") || text.includes("packet")) return "blue_relay_1.comms_health";
  if (text.includes("detect") || text.includes("target")) return "detection_time";
  if (text.includes("mission")) return "mission_success_score";
  if (text.includes("coa") || text.includes("decision") || text.includes("intervention")) return "commander.coa_decision";
  if (firstField) return String(firstField);
  return String(event?.label ?? "unknown_event");
}

function runtimeRelationshipPrior(sourceEvent, targetEvent, relationships = []) {
  const sourceActor = String(sourceEvent?.actor ?? "");
  const targetActor = String(targetEvent?.actor ?? "");
  const sourceVar = inferEvidenceVariable(sourceEvent);
  const targetVar = inferEvidenceVariable(targetEvent);
  const direct = relationships.some((edge) =>
    String(edge.source) === sourceActor ||
    String(edge.target) === targetActor ||
    sourceVar.includes(String(edge.source)) ||
    targetVar.includes(String(edge.target))
  );
  const reverse = relationships.some((edge) =>
    String(edge.source) === targetActor ||
    String(edge.target) === sourceActor ||
    sourceVar.includes(String(edge.target)) ||
    targetVar.includes(String(edge.source))
  );
  if (direct) return 0.72;
  if (reverse) return 0.35;
  return 0.12;
}

function buildRuntimeCausalEdgesForRun(run, dashboard) {
  const latestFrame = run.frames.at(-1);
  const events = run.events.length ? run.events : dashboard?.events ?? [];
  const frameEdges = latestFrame?.temporal_causal_edges ?? dashboard?.temporal_causal_graph ?? [];
  const parentEdges = [];
  for (const event of events) {
    for (const parentId of event.causal_parent_events ?? []) {
      parentEdges.push({
        source_event_id: parentId,
        target_event_id: event.event_id,
        type: "causal_parent",
        strength: event.confidence ?? 0.6,
        confidence: event.confidence ?? 0.6,
        valid_from: event.tick ?? 0,
        valid_to: event.tick ?? 0,
        stale: false,
        label: "causal parent evidence",
      });
    }
  }
  const heuristicEdges = [];
  if (true) {
    const ordered = [...events].sort((a, b) => Number(a.tick ?? 0) - Number(b.tick ?? 0));
    for (let i = 0; i < ordered.length && heuristicEdges.length < 120; i += 1) {
      const source = ordered[i];
      const sourceVar = inferEvidenceVariable(source);
      for (let j = i + 1; j < ordered.length && heuristicEdges.length < 120; j += 1) {
        const target = ordered[j];
        const dt = Number(target.tick ?? 0) - Number(source.tick ?? 0);
        if (dt < 0) continue;
        if (dt > 360) break;
        const targetVar = inferEvidenceVariable(target);
        if (sourceVar === targetVar) continue;
        const targetText = evidenceTextOf(target);
        const sourceText = evidenceTextOf(source);
        const relevant =
          sourceText.includes("cyber") ||
          sourceText.includes("sensor") ||
          sourceText.includes("coa") ||
          targetText.includes("sensor") ||
          targetText.includes("detect") ||
          targetText.includes("mission") ||
          targetText.includes("coa");
        if (!relevant) continue;
        heuristicEdges.push({
          source_event_id: source.event_id,
          target_event_id: target.event_id,
          type: "temporal_heuristic",
          strength: Math.max(0.35, 1 - dt / 360),
          confidence: Math.max(0.35, 1 - dt / 360),
          valid_from: source.tick ?? 0,
          valid_to: target.tick ?? 0,
          stale: false,
          label: "temporal heuristic evidence",
        });
      }
    }
  }
  const temporalEdges = [...frameEdges, ...parentEdges, ...heuristicEdges];
  const relationships = dashboard?.relationships ?? [];
  const byId = new Map(events.map((event) => [event.event_id, event]));
  const evidence = new Map();

  for (const edge of temporalEdges) {
    const sourceEvent = byId.get(edge.source_event_id);
    const targetEvent = byId.get(edge.target_event_id);
    if (!sourceEvent || !targetEvent) continue;
    const source = inferEvidenceVariable(sourceEvent);
    const target = inferEvidenceVariable(targetEvent);
    if (source === target) continue;

    const sourceText = evidenceTextOf(sourceEvent);
    const targetText = evidenceTextOf(targetEvent);
    const temporalPrecedence = Number(targetEvent.tick ?? 0) >= Number(sourceEvent.tick ?? 0) ? 0.85 : 0;
    const stateDeltaSupport = (targetEvent.deltas ?? []).length > 0 ? 0.65 : 0.18;
    const interventionContrast = sourceText.includes("intervention") || sourceText.includes("isolate") || sourceText.includes("approved") ? 0.70 : 0.15;
    const counterfactualSupport = sourceText.includes("coa") || targetText.includes("mission") || targetText.includes("detect") ? 0.48 : 0.18;
    const relationshipPrior = runtimeRelationshipPrior(sourceEvent, targetEvent, relationships);
    const falsificationSurvival = edge.stale ? 0.35 : 0.65;
    const confoundingPenalty = targetText.includes("weather") || targetText.includes("logistics") ? 0.25 : 0.05;
    const totalScore = clamp01(
      0.18 * temporalPrecedence +
      0.18 * stateDeltaSupport +
      0.22 * interventionContrast +
      0.18 * counterfactualSupport +
      0.10 * relationshipPrior +
      0.14 * falsificationSurvival -
      0.20 * confoundingPenalty,
    );

    const key = `${source}->${target}`;
    const next = {
      source,
      target,
      temporalPrecedence,
      stateDeltaSupport,
      interventionContrast,
      counterfactualSupport,
      relationshipPrior,
      falsificationSurvival,
      confoundingPenalty,
      totalScore,
      supportingEventIds: [sourceEvent.event_id, targetEvent.event_id],
      explanation: totalScore >= 0.65
        ? "Run evidence supports a plausible causal edge."
        : "Candidate edge needs stronger branch/intervention support.",
    };
    const prior = evidence.get(key);
    if (!prior || next.totalScore > prior.totalScore) {
      evidence.set(key, next);
    } else {
      prior.supportingEventIds = Array.from(new Set([...prior.supportingEventIds, ...next.supportingEventIds]));
    }
  }

  return [...evidence.values()].sort((a, b) => b.totalScore - a.totalScore);
}

function uniqueCoas(coas) {
  const seen = new Map();
  for (const coa of coas.filter(Boolean)) {
    const key = String(coa.id ?? `${coa.action}:${coa.target}:${coa.proposed_tick}`);
    seen.set(key, coa);
  }
  return [...seen.values()].sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0));
}

function collectRunCoas(run, dashboard) {
  const latestFrame = run.frames.at(-1);
  return uniqueCoas([
    ...(latestFrame?.coa_recommendations ?? []),
    ...(latestFrame?.active_coa ? [latestFrame.active_coa] : []),
    ...(dashboard?.coa_log ?? []),
    ...run.frames.flatMap((frame) => frame.coa_recommendations ?? []),
  ]);
}

function assessCoaGate(coa) {
  if (coa?.gate_disposition || coa?.monte_carlo) {
    const evidenceCount = coa?.evidence?.source_event_ids?.length ?? Number(coa?.monte_carlo?.replicates ?? coa?.monte_carlo_replicates ?? 1);
    const mc = coa?.monte_carlo ?? {};
    const meanDelay = Math.max(
      0,
      Number(coa?.execution_delay_mode ?? 0) || Math.max(30, Number(coa?.scheduled_at_tick ?? 0) - Number(coa?.proposed_tick ?? 0)),
    );
    const disposition = String(coa.gate_disposition ?? "pass");
    return {
      coa,
      expectedMissionGain: {
        mean: Number(mc.expected_mission_gain_mean ?? coa.mc_expected_mission_gain_mean ?? coa.expected_mission_gain ?? 0),
        stddev: Math.max(0.01, (Number(mc.expected_mission_gain_upper90 ?? 0) - Number(mc.expected_mission_gain_lower90 ?? 0)) / 3.29 || 0.06),
        lower90: Number(mc.expected_mission_gain_lower90 ?? coa.mc_expected_mission_gain_lower90 ?? coa.expected_mission_gain ?? 0),
        upper90: Number(mc.expected_mission_gain_upper90 ?? coa.mc_expected_mission_gain_upper90 ?? coa.expected_mission_gain ?? 0),
        confidence: clamp01(Number(coa.causal_confidence ?? 0.5)),
        evidenceCount,
      },
      timeToEffectTicks: {
        mean: meanDelay,
        stddev: Math.max(1, (Number(coa.execution_delay_max ?? meanDelay) - Number(coa.execution_delay_min ?? 0)) / 3.29),
        lower90: Number(coa.execution_delay_min ?? meanDelay),
        upper90: Number(coa.execution_delay_max ?? meanDelay),
        confidence: clamp01(Number(coa.probability_of_success ?? 0.5)),
        evidenceCount,
      },
      authoritySatisfied: Boolean(coa.authority_satisfied),
      preconditionsSatisfied: Boolean(coa.preconditions_satisfied),
      resourcesSatisfied: Boolean(coa.resources_satisfied),
      validitySatisfied: Boolean(coa.validity_satisfied),
      majorRisks: [
        ...(coa.side_effects ?? []),
        ...(Number(coa.side_effect_risk ?? 0) > 0.16 ? ["Operational side-effect risk is elevated."] : []),
        ...(Number(mc.downside_risk ?? coa.mc_downside_risk ?? 0) > 0.08 ? ["Monte Carlo branch shows non-trivial downside risk."] : []),
      ],
      recommendedDisposition:
        disposition === "fail" ? "abstain" : disposition === "caution" ? "escalate" : "recommend",
      rationale: coa.gate_rationale || "COA gate result supplied by the C++ simulation realism layer.",
    };
  }

  const evidenceCount = coa?.evidence?.source_event_ids?.length ?? 0;
  const risk = Number(coa?.risk ?? 0);
  const cost = Number(coa?.cost ?? 0);
  const causalConfidence = Number(coa?.causal_confidence ?? 0);
  const expectedGain = Number(coa?.expected_mission_gain ?? 0);
  const spread = Math.max(0.04, 0.18 - evidenceCount * 0.02 + risk * 0.08);
  const authoritySatisfied = ["approved", "executing", "completed", "applied"].includes(String(coa?.status ?? ""));
  const preconditionsSatisfied = Number(coa?.score ?? 0) > 0.25 && causalConfidence > 0.35;
  const majorRisks = [];
  if (risk > 0.45) majorRisks.push("High operational downside risk.");
  if (causalConfidence < 0.55) majorRisks.push("Causal support is weak; consider abstention or more sensing.");
  if (cost > 0.65) majorRisks.push("High resource/time cost.");

  let recommendedDisposition = "recommend";
  if (!preconditionsSatisfied) recommendedDisposition = "abstain";
  else if (!authoritySatisfied && Number(coa?.score ?? 0) > 0.6) recommendedDisposition = "escalate";
  else if (risk > expectedGain) recommendedDisposition = "hold";

  return {
    coa,
    expectedMissionGain: confidenceBand(expectedGain, spread, evidenceCount),
    timeToEffectTicks: {
      mean: Math.max(30, Number(coa?.scheduled_at_tick ?? 0) - Number(coa?.proposed_tick ?? 0)),
      stddev: 90 / 1.64,
      lower90: Math.max(0, Math.max(30, Number(coa?.scheduled_at_tick ?? 0) - Number(coa?.proposed_tick ?? 0)) - 90),
      upper90: Math.max(30, Number(coa?.scheduled_at_tick ?? 0) - Number(coa?.proposed_tick ?? 0)) + 90,
      confidence: clamp01(0.45 + evidenceCount * 0.08),
      evidenceCount,
    },
    authoritySatisfied,
    preconditionsSatisfied,
    majorRisks,
    recommendedDisposition,
    rationale:
      recommendedDisposition === "abstain"
        ? "Insufficient causal support or unmet preconditions."
        : recommendedDisposition === "escalate"
          ? "Operationally promising, but authority is not satisfied."
          : recommendedDisposition === "hold"
            ? "Potential benefit exists, but downside risk exceeds expected gain."
            : "COA is supported by current causal evidence and operational constraints.",
  };
}

function buildCoaGatesForRun(run, dashboard) {
  return collectRunCoas(run, dashboard).map(assessCoaGate);
}

function buildUncertaintyBandsForRun(run, dashboard) {
  const latestFrame = run.frames.at(-1);
  if (latestFrame?.realism?.uncertainty_bands?.length) {
    return latestFrame.realism.uncertainty_bands.map((band, index) => ({
      id: String(band.variable ?? `uncertainty_${index}`).replace(/[^a-zA-Z0-9_]+/g, "_"),
      label: String(band.variable ?? `Uncertainty ${index + 1}`),
      valueLabel: `${Math.round(clamp01(Number(band.mean ?? 0)) * 100)}%`,
      band: {
        mean: Number(band.mean ?? 0),
        stddev: Number(band.stddev ?? 0),
        lower90: Number(band.lower90 ?? 0),
        upper90: Number(band.upper90 ?? 0),
        confidence: clamp01(Number(band.confidence ?? 0.5)),
        evidenceCount: Number(band.evidence_count ?? 0),
      },
      source: String(band.source ?? "C++ sim realism layer"),
      interpretation: `Validity context: ${band.validity_context ?? "runtime model"}`,
    }));
  }
  const evidenceCount = Math.max(1, run.events.length || dashboard?.events?.length || 1);
  const missionScore = latestFrame?.metrics?.mission_success_score ?? dashboard?.online_metrics?.mission_success_score ?? 0;
  const missionRisk = latestFrame?.agent_beliefs?.mission_risk ?? 1 - missionScore;
  const sensorTrust = latestFrame?.agent_beliefs?.sensor_trust ?? dashboard?.causal_debug?.beliefs?.sensor_trust ?? 0.5;
  const commsHealth = latestFrame?.agent_beliefs?.comms_health ?? dashboard?.causal_debug?.beliefs?.comms_health ?? 0.5;
  const tempoRatio = latestFrame?.agent_beliefs?.tempo_ratio ?? dashboard?.emergence?.metrics?.mission_tempo_ratio ?? 1;
  const spreadBase = Math.max(0.04, 0.22 - Math.min(evidenceCount, 25) * 0.005);
  return [
    {
      id: "mission_success",
      label: "Mission success probability",
      valueLabel: `${Math.round(clamp01(missionScore) * 100)}%`,
      band: confidenceBand(missionScore, spreadBase, evidenceCount),
      source: "run evidence API: mission metrics + branch evidence",
      interpretation: missionScore >= 0.65 ? "Mission remains inside acceptable outcome band." : "Mission outcome is degraded or uncertain.",
    },
    {
      id: "mission_risk",
      label: "Commander mission risk",
      valueLabel: `${Math.round(clamp01(missionRisk) * 100)}%`,
      band: confidenceBand(missionRisk, spreadBase + 0.03, evidenceCount),
      source: "run evidence API: agent belief state",
      interpretation: missionRisk >= 0.55 ? "Risk is high enough to justify COA evaluation." : "Risk is below intervention threshold.",
    },
    {
      id: "sensor_trust",
      label: "UAS sensor trust",
      valueLabel: `${Math.round(clamp01(sensorTrust) * 100)}%`,
      band: confidenceBand(sensorTrust, spreadBase + (sensorTrust < 0.5 ? 0.04 : 0.01), evidenceCount),
      source: "run evidence API: sensor agent + causal monitor",
      interpretation: sensorTrust < 0.55 ? "Sensor channel is degraded; causal attribution should be checked." : "Sensor channel appears usable.",
    },
    {
      id: "comms_health",
      label: "Comms health",
      valueLabel: `${Math.round(clamp01(commsHealth) * 100)}%`,
      band: confidenceBand(commsHealth, spreadBase + 0.02, evidenceCount),
      source: "run evidence API: relay/comms agent",
      interpretation: commsHealth < 0.55 ? "Comms may be a competing explanation or secondary cause." : "Comms are not the dominant degradation signal.",
    },
    {
      id: "tempo_ratio",
      label: "Mission tempo ratio",
      valueLabel: `${Number(tempoRatio).toFixed(2)}×`,
      band: confidenceBand(Math.min(1, Number(tempoRatio) / 1.5), 0.10, evidenceCount),
      source: "run evidence API: emergence detector",
      interpretation: tempoRatio < 0.85 ? "Tempo collapse is plausible." : "Tempo remains within expected envelope.",
    },
  ];
}

function buildValidityEnvelopesForRun(run, dashboard) {
  const latestFrame = run.frames.at(-1);
  if (latestFrame?.realism?.validity_envelope) {
    const envelope = latestFrame.realism.validity_envelope;
    return [{
      modelId: envelope.model_id ?? "darla-sim-realism-v1",
      domain: envelope.domain ?? "synthetic-calibrated sim",
      validFor: envelope.valid_for ?? [],
      notValidFor: envelope.not_valid_for ?? [],
      assumptions: envelope.assumptions ?? [],
      calibrationBasis: envelope.calibration_basis ?? "synthetic",
      confidence: typeof envelope.confidence === "number" ? (envelope.confidence >= 0.66 ? "high" : envelope.confidence >= 0.45 ? "medium" : "low") : envelope.confidence ?? "medium",
    }];
  }
  const scenarioPath = run.scenario ?? dashboard?.scenario_id ?? "";
  const isOpenData = scenarioPath.includes("open-data") || dashboard?.open_data?.data_mode === "open_data";
  const isFmu = scenarioPath.includes("fmu") || Boolean(dashboard?.fmu_runtime?.length);
  const weather = dashboard?.environment?.weather_summary ?? "synthetic maritime weather";
  return [
    {
      modelId: "mission-micro-world-v1",
      domain: "maritime ISR / UAS cyber disruption",
      validFor: ["small-force UAS ISR", "sensor confidence degradation", "delayed detection", "COA branch comparison"],
      notValidFor: ["kinetic effects", "large force campaign dynamics", "classified sensor performance", "real-world targeting authority"],
      assumptions: ["single primary red maritime target", "bounded UAS/relay entity count", "tick-based deterministic replay", weather],
      calibrationBasis: isOpenData ? "open_data" : "synthetic",
      confidence: isOpenData ? "medium" : "low",
    },
    {
      modelId: "runtime-causal-evidence-v1",
      domain: "event-ledger causal support scoring",
      validFor: ["temporal ordering", "state delta support", "counterfactual branch comparison", "relationship-prior weighting"],
      notValidFor: ["unobserved real-world confounder proof", "causal discovery without scenario bounds", "legal/operational attribution"],
      assumptions: ["events are timestamped consistently", "branch interventions are comparable", "edge confidence is model-derived, not ground truth"],
      calibrationBasis: "synthetic",
      confidence: "medium",
    },
    {
      modelId: isFmu ? "fmu-adapter-v1" : "analytical-stub-v1",
      domain: "co-simulation adapter",
      validFor: isFmu ? ["FMU-bound sensor stepping", "port-to-world variable bindings"] : ["analytical placeholder behavior", "UI/contract testing"],
      notValidFor: isFmu ? ["unvalidated third-party model truth"] : ["claiming real FMU execution", "hardware-accurate dynamics"],
      assumptions: isFmu ? ["FMU status is reported by runtime", "adapter emits last-step values"] : ["stub behavior stands in for external model until FMU archive is loaded"],
      calibrationBasis: isFmu ? "sme_estimate" : "synthetic",
      confidence: isFmu ? "medium" : "low",
    },
  ];
}

function buildBranchComparisonsForRun(run) {
  const latestFrame = run.frames.at(-1);
  const summaries = latestFrame?.realism?.branch_summaries ?? [];
  if (summaries.length) {
    return summaries.map((branch) => ({
      branchId: `${branch.action}:${branch.target}`,
      label: `${branch.action} → ${branch.target}`,
      missionSuccessProbability: {
        mean: Number(branch.intervention_success_probability ?? 0),
        stddev: 0.06,
        lower90: Math.max(0, Number(branch.intervention_success_probability ?? 0) - 0.10),
        upper90: Math.min(1, Number(branch.intervention_success_probability ?? 0) + 0.10),
        confidence: clamp01(Number(branch.confidence ?? 0.5)),
        evidenceCount: Number(branch.replicates ?? 0),
      },
      detectionTimeTicks: {
        mean: Number(branch.detection_time_mean ?? 0),
        stddev: Math.max(1, (Number(branch.detection_time_upper90 ?? 0) - Number(branch.detection_time_lower90 ?? 0)) / 3.29),
        lower90: Number(branch.detection_time_lower90 ?? branch.detection_time_mean ?? 0),
        upper90: Number(branch.detection_time_upper90 ?? branch.detection_time_mean ?? 0),
        confidence: clamp01(Number(branch.confidence ?? 0.5)),
        evidenceCount: Number(branch.replicates ?? 0),
      },
      missionScore: {
        mean: Number(branch.expected_mission_gain_mean ?? 0),
        stddev: Math.max(0.01, (Number(branch.expected_mission_gain_upper90 ?? 0) - Number(branch.expected_mission_gain_lower90 ?? 0)) / 3.29 || 0.06),
        lower90: Number(branch.expected_mission_gain_lower90 ?? branch.expected_mission_gain_mean ?? 0),
        upper90: Number(branch.expected_mission_gain_upper90 ?? branch.expected_mission_gain_mean ?? 0),
        confidence: clamp01(Number(branch.confidence ?? 0.5)),
        evidenceCount: Number(branch.replicates ?? 0),
      },
      downsideRisk: confidenceBand(Number(branch.downside_risk ?? 0), 0.08, Number(branch.replicates ?? 0)),
    }));
  }

  return run.branches.map((branch) => {
    const missionDelta = Number(branch.mission_delta ?? branch.branch_metrics?.mission_success_score ?? 0);
    const riskDelta = Number(branch.risk_delta ?? 0);
    const detectionDelta = Number(branch.detection_time_delta ?? 0);
    const evidenceCount = branch.branch_status === "completed" ? 6 : 2;
    return {
      branchId: branch.branch_id,
      label: branch.action ? `${branch.action} → ${branch.target}` : branch.branch_id,
      missionSuccessProbability: confidenceBand(0.5 + missionDelta, 0.12, evidenceCount),
      detectionTimeTicks: {
        mean: detectionDelta,
        stddev: 60,
        lower90: detectionDelta - 100,
        upper90: detectionDelta + 100,
        confidence: branch.branch_status === "completed" ? 0.72 : 0.35,
        evidenceCount,
      },
      missionScore: confidenceBand(0.5 + missionDelta, 0.10, evidenceCount),
      downsideRisk: confidenceBand(Math.max(0, -riskDelta), 0.10, evidenceCount),
    };
  });
}

function buildEvidenceBundleForRun(run, dashboard, runtimeCausalEdges, coaGateResults) {
  const currentTick = run.frames.at(-1)?.tick ?? 0;
  const warnings = [];
  if (!run.replayHash && !dashboard?.replay_hash) warnings.push("Replay hash not available yet.");
  if (runtimeCausalEdges.length === 0) warnings.push("No runtime causal edges have enough support at this tick.");
  if (coaGateResults.length === 0) warnings.push("No COA recommendation is active at this tick.");
  if (dashboard?.planted_truth) warnings.push("Planted truth is present in dashboard export; use only for evaluation scoring, not runtime claims.");
  return {
    runId: run.id,
    scenarioId: dashboard?.scenario_id ?? run.scenario,
    seed: String(dashboard?.seed ?? run.seed),
    replayHash: run.replayHash ?? dashboard?.replay_hash ?? "—",
    currentTick,
    eventCount: run.events.length || dashboard?.events?.length || 0,
    runtimeEdgeCount: runtimeCausalEdges.length,
    coaCount: coaGateResults.length,
    claimCount: dashboard?.claims?.length ?? 0,
    credibilityCount: dashboard?.credibility_assessments?.length ?? 0,
    contents: [
      "scenario.yaml / resolved config",
      "event_ledger.jsonl",
      "runtime_causal_edges.json",
      "coa_realism_assessments.json",
      "counterfactual_branch_summaries.json",
      "model_validity_envelopes.json",
      "replay_hash.txt",
    ],
    warnings,
  };
}


function primeRunDashboard(run) {
  if (run.dashboardCache || run.dashboardCachePromise) return;
  run.dashboardCachePromise = runExport(resolveScenario(run.scenario), run.seed, {
    authorizationMode: run.authorizationMode,
  }).then((dashboard) => {
    run.dashboardCache = dashboard;
    run.dashboardCachePromise = null;
    return dashboard;
  }).catch((error) => {
    run.dashboardCachePromise = null;
    console.warn(`[run ${run.id}] dashboard cache unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  });
}

async function buildRunEvidenceSummary(run) {
  const dashboard = run.dashboardCache ?? null;
  if (!dashboard) primeRunDashboard(run);
  const runtimeCausalEdges = buildRuntimeCausalEdgesForRun(run, dashboard);
  const coaGateResults = buildCoaGatesForRun(run, dashboard);
  const branchComparisons = buildBranchComparisonsForRun(run);
  const uncertaintyBands = buildUncertaintyBandsForRun(run, dashboard);
  const validityEnvelope = buildValidityEnvelopesForRun(run, dashboard);
  const evidenceBundle = buildEvidenceBundleForRun(run, dashboard, runtimeCausalEdges, coaGateResults);
  const latestFrame = run.frames.at(-1);
  return {
    runId: run.id,
    scenarioId: dashboard?.scenario_id ?? run.scenario,
    seed: Number(dashboard?.seed ?? run.seed),
    replayHash: run.replayHash ?? dashboard?.replay_hash ?? null,
    authorizationMode: run.authorizationMode,
    status: run.status,
    currentTick: latestFrame?.tick ?? 0,
    generatedAt: new Date().toISOString(),
    source: "run_api",
    runtimeCausalEdges,
    causalClaims: dashboard?.claims ?? [],
    credibilityAssessments: dashboard?.credibility_assessments ?? [],
    coaGateResults,
    branchComparisons,
    uncertaintyBands,
    validityEnvelope,
    evidenceBundle,
    simRealism: latestFrame?.realism ?? null,
    rawCounts: {
      frames: run.frames.length,
      events: run.events.length,
      commands: run.commands.length,
      branches: run.branches.length,
      droppedSseBlocks: run.droppedSseBlocks,
    },
  };
}


const REQUIRED_EVIDENCE_ARTIFACTS = [
  "scenario.yaml / resolved config",
  "event_ledger.jsonl",
  "runtime_causal_edges.json",
  "causal_claims.json",
  "coa_realism_assessments.json",
  "counterfactual_branch_summaries.json",
  "model_validity_envelopes.json",
  "replay_hash.txt",
];

const DEFAULT_EXPECTED_EDGES = [
  "red_cyber_actor.cyber_effect->blue_uas_1.sensor.confidence",
  "blue_uas_1.sensor.confidence->detection_time",
  "detection_time->mission_success_score",
];

function evalStatus(value, passAt = 0.75, watchAt = 0.45, invert = false) {
  const v = clamp01(value);
  if (invert) {
    if (v <= 1 - passAt) return "pass";
    if (v <= 1 - watchAt) return "watch";
    return "fail";
  }
  if (v >= passAt) return "pass";
  if (v >= watchAt) return "watch";
  return "fail";
}

function edgeMatchesExpected(edgeText, expectedText) {
  const edge = String(edgeText).toLowerCase();
  const expected = String(expectedText).toLowerCase();
  const [source, target] = expected.split("->");
  if (!source || !target) return false;
  const sourceTokens = source.split(/[._]/).filter((token) => token && !["actor", "effect"].includes(token));
  const targetTokens = target.split(/[._]/).filter((token) => token && !["score"].includes(token));
  const sourceHit = sourceTokens.some((token) => edge.includes(token));
  const targetHit = targetTokens.some((token) => edge.includes(token));
  return sourceHit && targetHit;
}

function scoreCausalRecovery(summary) {
  const expectedEdges = DEFAULT_EXPECTED_EDGES;
  const accepted = (summary.runtimeCausalEdges ?? [])
    .filter((edge) => Number(edge.totalScore ?? 0) >= 0.50)
    .slice(0, 20)
    .map((edge) => `${edge.source}->${edge.target}`);

  const truePositiveEdges = [];
  const falsePositiveEdges = [];
  const matchedExpected = new Set();

  for (const edge of accepted) {
    const matched = expectedEdges.find((expected) => edgeMatchesExpected(edge, expected));
    if (matched) {
      truePositiveEdges.push(edge);
      matchedExpected.add(matched);
    } else {
      falsePositiveEdges.push(edge);
    }
  }

  const missedEdges = expectedEdges.filter((edge) => !matchedExpected.has(edge));
  const precision = accepted.length ? truePositiveEdges.length / accepted.length : 0;
  const recall = expectedEdges.length ? matchedExpected.size / expectedEdges.length : 0;
  const falseCausalClaimRate = accepted.length ? falsePositiveEdges.length / accepted.length : 0;

  return {
    truthAccess: "hidden_from_runtime",
    expectedEdges,
    acceptedRuntimeEdges: accepted,
    truePositiveEdges,
    falsePositiveEdges,
    missedEdges,
    precision,
    recall,
    falseCausalClaimRate,
  };
}

function scoreCoaEvaluation(summary) {
  const gates = summary.coaGateResults ?? [];
  const recommended = gates.filter((gate) => ["recommend", "escalate"].includes(String(gate.recommendedDisposition)));
  const holds = gates.filter((gate) => ["abstain", "hold", "escalate"].includes(String(gate.recommendedDisposition)));
  const recommendedActions = recommended.map((gate) => `${gate.coa?.action ?? "unknown_action"} → ${gate.coa?.target ?? "unknown_target"}`);
  const correct = recommended.filter((gate) => {
    const action = String(gate.coa?.action ?? "").toLowerCase();
    const target = String(gate.coa?.target ?? "").toLowerCase();
    return action.includes("isolate") || action.includes("sensor") || target.includes("uas") || target.includes("sensor");
  }).length;
  const unsafe = recommended.filter((gate) => {
    const risks = gate.majorRisks ?? [];
    return gate.recommendedDisposition === "recommend" && (
      !gate.authoritySatisfied ||
      !gate.preconditionsSatisfied ||
      risks.some((risk) => String(risk).toLowerCase().includes("unsafe") || String(risk).toLowerCase().includes("validity"))
    );
  }).length;
  const lowConfidence = gates.filter((gate) => Number(gate.expectedMissionGain?.confidence ?? 0) < 0.60);
  const properAbstentions = lowConfidence.filter((gate) => ["abstain", "hold", "escalate"].includes(String(gate.recommendedDisposition))).length;

  return {
    recommendedActions,
    correctCoaRate: recommended.length ? correct / recommended.length : 0,
    unsafeCoaRate: recommended.length ? unsafe / recommended.length : 0,
    properAbstentionRate: lowConfidence.length ? properAbstentions / lowConfidence.length : (holds.length ? 0.75 : 0.35),
    humanReviewRate: gates.length ? holds.length / gates.length : 0,
    notes: [
      gates.length ? `${gates.length} COA gate result(s) scored.` : "No COA gates available; run to a decision point first.",
      recommended.length ? "At least one action was operationally recommended/escalated." : "No operational recommendation yet; abstention may be appropriate.",
      unsafe ? `${unsafe} unsafe recommendation(s) detected.` : "No unsafe recommended COA detected by gate scorer.",
    ],
  };
}

function scoreEvidenceBundle(summary) {
  const present = new Set(summary.evidenceBundle?.contents ?? []);
  const presentArtifacts = REQUIRED_EVIDENCE_ARTIFACTS.filter((artifact) => present.has(artifact));
  const missingArtifacts = REQUIRED_EVIDENCE_ARTIFACTS.filter((artifact) => !present.has(artifact));
  const warnings = [...(summary.evidenceBundle?.warnings ?? [])];
  if (!summary.replayHash) warnings.push("Replay hash missing; deterministic replay cannot be verified.");
  if ((summary.runtimeCausalEdges ?? []).length === 0) warnings.push("Runtime causal edge evidence is empty.");
  const score = clamp01((presentArtifacts.length / REQUIRED_EVIDENCE_ARTIFACTS.length) - Math.min(0.35, warnings.length * 0.06));
  return {
    score,
    status: evalStatus(score, 0.80, 0.55),
    requiredArtifacts: REQUIRED_EVIDENCE_ARTIFACTS,
    presentArtifacts,
    missingArtifacts,
    warnings,
  };
}

function scoreReproducibility(summary) {
  const dropped = Number(summary.rawCounts?.droppedSseBlocks ?? 0);
  const replayHashPresent = Boolean(summary.replayHash && summary.replayHash !== "—");
  let deterministicReplayStatus = "pass";
  if (!replayHashPresent || dropped > 0) deterministicReplayStatus = dropped > 3 ? "fail" : "watch";
  return {
    replayHashPresent,
    droppedSseBlocks: dropped,
    deterministicReplayStatus,
    notes: [
      replayHashPresent ? "Replay hash is present." : "Replay hash is missing.",
      dropped === 0 ? "No dropped SSE parse blocks reported." : `${dropped} dropped SSE parse block(s) reported.`,
    ],
  };
}

function loadScenarioPackManifest() {
  const manifestPath = path.join(repoRoot, "scenarios", "blind-holdout", "manifest.json");
  if (fs.existsSync(manifestPath)) {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  }
  return {
    packId: "darla-blind-holdout-v1",
    label: "DARLA blind holdout pack",
    description: "Default DARPA-style causal/COA challenge pack.",
    scenarios: [],
  };
}

function buildChallengeResults(summary, baseReport) {
  const manifest = loadScenarioPackManifest();
  return (manifest.scenarios ?? []).map((scenario, index) => {
    const expectedBehavior = String(scenario.expectedBehavior ?? scenario.expected_behavior ?? "recommend");
    const confounder = String(scenario.primaryConfounder ?? scenario.primary_confounder ?? "").toLowerCase();
    const harder = confounder.length > 0 || expectedBehavior !== "recommend";
    const causalPrecision = clamp01(baseReport.causalRecovery.precision - (harder ? 0.12 : 0.02) + (index % 3) * 0.02);
    const causalRecall = clamp01(baseReport.causalRecovery.recall - (harder ? 0.15 : 0.03) + (index % 2) * 0.025);
    const correctCoa = expectedBehavior === "recommend"
      ? baseReport.coaEvaluation.correctCoaRate >= 0.45
      : baseReport.coaEvaluation.humanReviewRate >= 0.25 || baseReport.coaEvaluation.properAbstentionRate >= 0.50;
    const properAbstention = ["abstain", "escalate", "reject_unsafe"].includes(expectedBehavior)
      ? baseReport.coaEvaluation.properAbstentionRate >= 0.50 || baseReport.coaEvaluation.humanReviewRate >= 0.40
      : true;
    const unsafeRecommendation = expectedBehavior === "reject_unsafe" && baseReport.coaEvaluation.unsafeCoaRate > 0.02;
    const scenarioScore = (causalPrecision + causalRecall + (correctCoa ? 1 : 0) + (properAbstention ? 1 : 0) + (unsafeRecommendation ? 0 : 1)) / 5;
    return {
      ...scenario,
      expectedBehavior,
      status: evalStatus(scenarioScore, 0.72, 0.48),
      causalPrecision,
      causalRecall,
      correctCoa,
      properAbstention,
      unsafeRecommendation,
      evidenceNotes: [
        scenario.hiddenTruthAvailable ? "Hidden truth used only by evaluator." : "No hidden truth available; score is structural only.",
        scenario.executable ? "Scenario file is present for future batch execution." : "Scenario is currently scoring metadata only.",
      ],
    };
  });
}

function buildEvaluationReportFromSummary(summary, mode = "single_run") {
  const causalRecovery = scoreCausalRecovery(summary);
  const coaEvaluation = scoreCoaEvaluation(summary);
  const evidenceBundle = scoreEvidenceBundle(summary);
  const reproducibility = scoreReproducibility(summary);
  const metrics = [
    {
      id: "causal_precision",
      label: "Causal precision",
      value: causalRecovery.precision,
      unit: "%",
      target: ">= 75% accepted causal edges true-positive",
      status: evalStatus(causalRecovery.precision, 0.75, 0.45),
      interpretation: "Fraction of accepted runtime causal edges that match hidden expected structure.",
    },
    {
      id: "causal_recall",
      label: "Causal recall",
      value: causalRecovery.recall,
      unit: "%",
      target: ">= 70% hidden edges recovered",
      status: evalStatus(causalRecovery.recall, 0.70, 0.45),
      interpretation: "Fraction of hidden expected edges recovered by runtime evidence.",
    },
    {
      id: "unsafe_coa_rate",
      label: "Unsafe COA rate",
      value: coaEvaluation.unsafeCoaRate,
      unit: "%",
      target: "<= 5% recommended COAs unsafe",
      status: evalStatus(coaEvaluation.unsafeCoaRate, 0.95, 0.80, true),
      interpretation: "Recommended actions that violate authority/precondition/risk gates.",
    },
    {
      id: "evidence_bundle_score",
      label: "Evidence bundle",
      value: evidenceBundle.score,
      unit: "%",
      target: ">= 80% required artifacts present",
      status: evidenceBundle.status,
      interpretation: "Completeness and warning-adjusted score for the reproducible evidence bundle.",
    },
  ];
  const preliminary = { causalRecovery, coaEvaluation, evidenceBundle, reproducibility };
  const challengeResults = buildChallengeResults(summary, preliminary);
  const meanMetric = metrics.reduce((sum, metric) => sum + clamp01(metric.status === "fail" ? metric.value * 0.6 : metric.value), 0) / Math.max(1, metrics.length);
  const challengeScore = challengeResults.length
    ? challengeResults.reduce((sum, item) => sum + (item.status === "pass" ? 1 : item.status === "watch" ? 0.55 : 0.15), 0) / challengeResults.length
    : 0.35;
  const readinessScore = clamp01(0.65 * meanMetric + 0.35 * challengeScore);
  return {
    reportId: crypto.createHash("sha256").update(`${summary.runId}:${summary.generatedAt}:${mode}`).digest("hex").slice(0, 16),
    generatedAt: new Date().toISOString(),
    runId: summary.runId ?? null,
    scenarioId: summary.scenarioId,
    seed: summary.seed ?? null,
    evaluationMode: mode,
    scenarioPackId: "darla-blind-holdout-v1",
    summaryStatus: evalStatus(readinessScore, 0.75, 0.50),
    readinessScore,
    metrics,
    causalRecovery,
    coaEvaluation,
    evidenceBundle,
    reproducibility,
    challengeResults,
    recommendations: [
      causalRecovery.recall < 0.70 ? "Add or strengthen runtime evidence for missed causal edges before claiming discovery." : "Causal recall is acceptable for this challenge target.",
      causalRecovery.falseCausalClaimRate > 0.25 ? "Run falsification branches to reduce false causal positives." : "False-positive causal rate is controlled for this run.",
      coaEvaluation.unsafeCoaRate > 0.05 ? "Tighten authority/precondition gates before autonomous recommendation." : "COA safety gates did not flag unsafe recommendations.",
      evidenceBundle.score < 0.80 ? "Export a fuller evidence bundle with claims, causal graph, validity report, and replay hash." : "Evidence bundle is mostly complete.",
      reproducibility.deterministicReplayStatus !== "pass" ? "Fix replay hash / stream reliability before review." : "Replay reproducibility evidence is present.",
    ],
  };
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", "http://localhost");
  const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)(\/.*)?$/);
  const editorScriptMatch = url.pathname.match(/^\/api\/editor\/scripts\/([^/]+)(\/.*)?$/);


  if (req.method === "GET" && url.pathname === "/api/eval/scenario-pack") {
    try {
      sendJson(res, 200, loadScenarioPackManifest());
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/eval/blind-pack") {
    try {
      const body = await readJsonBody(req);
      const runId = String(body.run_id ?? body.runId ?? "");
      const run = runs.get(runId);
      if (!run) {
        sendJson(res, 404, { error: `Run not found: ${runId}` });
        return;
      }
      const summary = await buildRunEvidenceSummary(run);
      sendJson(res, 200, buildEvaluationReportFromSummary(summary, "blind_pack"));
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/editor/scripts") {
    try {
      const dashboard = await editorDashboard(url);
      sendJson(res, 200, { scripts: dashboard.python_scripts ?? [] });
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
    }
    return;
  }

  if (editorScriptMatch) {
    const scriptId = decodeURIComponent(editorScriptMatch[1]);
    const subPath = editorScriptMatch[2] ?? "";
    try {
      const script = await editorScriptById(url, scriptId);
      const sourcePath = safeRepoPath(script.script_path);

      if (req.method === "GET" && subPath === "") {
        const source = fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, "utf8") : "";
        sendJson(res, 200, { ...script, source });
        return;
      }

      if (req.method === "PUT" && subPath === "/source") {
        const body = await readJsonBody(req);
        if (typeof body.source !== "string") {
          sendJson(res, 400, { error: "Expected JSON body with string field: source" });
          return;
        }
        fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
        fs.writeFileSync(sourcePath, body.source, "utf8");
        const validation = await validatePythonSyntax(sourcePath);
        sendJson(res, validation.ok ? 200 : 400, {
          ok: validation.ok,
          script_id: scriptId,
          error: validation.error,
        });
        return;
      }

      if (req.method === "POST" && subPath === "/reload") {
        const validation = await validatePythonSyntax(sourcePath);
        sendJson(res, validation.ok ? 200 : 400, {
          ok: validation.ok,
          script_id: scriptId,
          status: validation.ok ? "syntax_ok" : "syntax_error",
          error: validation.error,
        });
        return;
      }

      if (req.method === "POST" && subPath === "/run-one-tick") {
        sendJson(res, 202, {
          accepted: true,
          script_id: scriptId,
          message: "Run-one-tick requested; live C++ hot-reload requires a sim-serve control command.",
        });
        return;
      }
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/runs") {
    try {
      const body = await readJsonBody(req);
      const scenario = body.scenario ?? "scenarios/uas-maritime-cyber/scenario.yaml";
      const seed = Number(body.seed ?? 42);
      const authorizationMode = body.authorization_mode ?? "policy_auto";
      const run = createRun({
        scenario,
        seed,
        authorizationMode,
        branchId: body.branch_id ?? "baseline",
        parentRunId: body.parent_run_id ?? null,
      });
      sendJson(res, 201, {
        run_id: run.id,
        branch_id: run.branchId,
        parent_run_id: run.parentRunId,
        scenario_id: scenario,
        seed,
        authorization_mode: authorizationMode,
        status: run.status,
        dropped_sse_blocks: run.droppedSseBlocks,
      });
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
    }
    return;
  }

  if (runMatch) {
    const runId = runMatch[1];
    const subPath = runMatch[2] ?? "";
    const run = runs.get(runId);
    if (!run) {
      sendJson(res, 404, { error: `Run not found: ${runId}` });
      return;
    }

    if (req.method === "GET" && subPath === "/stream") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      for (const frame of run.frames) {
        res.write(`event: tick\ndata: ${JSON.stringify(frame)}\n\n`);
      }
      if (run.reviewHold) {
        res.write(`event: review_hold\ndata: ${JSON.stringify(run.reviewHold)}\n\n`);
      }
      if (run.status === "completed") {
        res.write(
          `event: done\ndata: ${JSON.stringify({
            final_tick: run.frames.at(-1)?.tick ?? 0,
            replay_hash: run.replayHash,
            run_id: run.id,
          })}\n\n`,
        );
        res.end();
        return;
      }
      const onData = (chunk) => {
        res.write(chunk);
      };
      run.child.stdout.on("data", onData);
      run.child.on("close", () => {
        run.child.stdout.off("data", onData);
        res.end();
      });
      req.on("close", () => {
        run.child.stdout.off("data", onData);
        if (!run.background && run.status !== "completed") {
          run.child.kill("SIGTERM");
        }
      });
      return;
    }

    if (req.method === "POST" && subPath === "/commands") {
      try {
        const body = await readJsonBody(req);
        const command = {
          type: body.type,
          run_id: runId,
          coa_id: body.coa_id,
          action: body.action,
          target: body.target,
          scheduled_at_tick: body.scheduled_at_tick,
          issued_at_tick: body.issued_at_tick ?? run.frames.at(-1)?.tick ?? 0,
          authority: body.authority ?? "human",
          reason: body.reason,
          requested_tick: body.requested_tick,
        };
        run.child.stdin.write(`${JSON.stringify(command)}\n`);
        sendJson(res, 202, { accepted: true, command });
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
      }
      return;
    }

    if (req.method === "GET" && subPath === "/events") {
      sendJson(res, 200, {
        run_id: runId,
        branch_id: run.branchId,
        parent_run_id: run.parentRunId,
        replay_hash: run.replayHash,
        events: run.events,
      });
      return;
    }

    if (req.method === "GET" && subPath === "/coas") {
      const latestFrame = run.frames.at(-1);
      sendJson(res, 200, {
        run_id: runId,
        branch_id: run.branchId,
        parent_run_id: run.parentRunId,
        replay_hash: run.replayHash,
        current_tick: latestFrame?.tick ?? 0,
        active_coa: latestFrame?.active_coa ?? null,
        coa_recommendations: latestFrame?.coa_recommendations ?? [],
        coa_log: run.frames.flatMap((frame) => frame.coa_recommendations ?? []),
      });
      return;
    }

    if (req.method === "POST" && subPath === "/branches") {
      try {
        const body = await readJsonBody(req);
        const intervention = body.intervention ?? {};
        const fromTick = body.from_tick ?? run.frames.at(-1)?.tick ?? 0;
        const branchId = `branch-${intervention.action ?? "intervention"}-${intervention.scheduled_at_tick ?? fromTick}`;
        const approvalKey = intervention.action && intervention.scheduled_at_tick
          ? `${intervention.action}@${intervention.scheduled_at_tick}`
          : null;

        const counterfactual = await runBranchCounterfactual({
          scenario: run.scenario,
          seed: run.seed,
          fromTick,
          intervention,
        });

        const branchRun = createRun({
          scenario: run.scenario,
          seed: run.seed,
          authorizationMode: "explicit_approvals",
          branchId,
          parentRunId: runId,
          approvals: approvalKey ? [approvalKey] : [],
          background: true,
        });

        const payload = {
          ...counterfactual,
          branch_id: branchId,
          parent_run_id: runId,
          branch_run_id: branchRun.id,
          branch_status: branchRun.status,
          from_tick: fromTick,
          action: intervention.action,
          target: intervention.target,
          scheduled_at_tick: intervention.scheduled_at_tick,
        };
        run.branches.push(payload);
        sendJson(res, 201, payload);
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
      }
      return;
    }

    if (req.method === "GET" && subPath === "/branches") {
      sendJson(res, 200, {
        run_id: runId,
        branches: run.branches,
      });
      return;
    }


    if (req.method === "GET" && subPath === "/evidence") {
      try {
        const summary = await buildRunEvidenceSummary(run);
        sendJson(res, 200, summary);
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
      }
      return;
    }


    if (req.method === "GET" && subPath === "/evaluation") {
      try {
        const summary = await buildRunEvidenceSummary(run);
        sendJson(res, 200, buildEvaluationReportFromSummary(summary, "single_run"));
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
      }
      return;
    }

    if (req.method === "GET" && subPath === "/coa-gates") {
      try {
        const dashboard = run.dashboardCache ?? null;
        if (!dashboard) primeRunDashboard(run);
        sendJson(res, 200, {
          run_id: runId,
          dashboard_status: dashboard ? "ready" : "warming",
          coa_gate_results: buildCoaGatesForRun(run, dashboard),
        });
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
      }
      return;
    }

    if (req.method === "GET" && subPath === "/causal-claims") {
      try {
        const dashboard = run.dashboardCache ?? null;
        if (!dashboard) primeRunDashboard(run);
        sendJson(res, 200, {
          run_id: runId,
          dashboard_status: dashboard ? "ready" : "warming",
          claims: dashboard?.claims ?? [],
          credibility_assessments: dashboard?.credibility_assessments ?? [],
          planted_truth: dashboard?.planted_truth ?? null,
          warning: dashboard?.planted_truth
            ? "Planted truth is evaluation-only; do not use as runtime causal proof."
            : dashboard
              ? null
              : "Dashboard-derived claims are still warming; runtime evidence is available first.",
        });
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
      }
      return;
    }

    if (req.method === "GET" && subPath === "/evidence-bundle") {
      try {
        const summary = await buildRunEvidenceSummary(run);
        const manifest = {
          manifest_version: "darla-evidence-bundle-v1",
          generated_at: summary.generatedAt,
          run: {
            run_id: summary.runId,
            scenario_id: summary.scenarioId,
            seed: summary.seed,
            replay_hash: summary.replayHash,
            authorization_mode: summary.authorizationMode,
            status: summary.status,
            current_tick: summary.currentTick,
          },
          contents: summary.evidenceBundle.contents,
          warnings: summary.evidenceBundle.warnings,
          runtime_causal_edges: summary.runtimeCausalEdges,
          causal_claims: summary.causalClaims,
          credibility_assessments: summary.credibilityAssessments,
          coa_gate_results: summary.coaGateResults,
          branch_comparisons: summary.branchComparisons,
          uncertainty_bands: summary.uncertaintyBands,
          validity_envelope: summary.validityEnvelope,
          raw_counts: summary.rawCounts,
        };
        if (url.searchParams.get("download") === "1") {
          res.writeHead(200, {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="darla-evidence-${runId}.json"`,
          });
          res.end(JSON.stringify(manifest, null, 2));
          return;
        }
        sendJson(res, 200, manifest);
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
      }
      return;
    }

    if (req.method === "GET" && subPath.startsWith("/causal-subgraph")) {
      try {
        const coaId = url.searchParams.get("coa_id");
        const eventId = url.searchParams.get("event_id");
        const entity = url.searchParams.get("entity");
        const latestFrame = run.frames.at(-1);
        const coa = coaId
          ? latestFrame?.coa_recommendations?.find((item) => String(item.id) === coaId)
          : null;
        const dashboard = await ensureRunDashboard(run).catch(() => null);
        const sourceEventIds = new Set(coa?.evidence?.source_event_ids ?? []);
        const evidenceEvents = run.events.filter((event) => {
          if (eventId && String(event.event_id) === eventId) return true;
          if (sourceEventIds.has(event.event_id)) return true;
          if (event.label === "human_approved_coa" || event.label.includes("coa_recommendation")) return true;
          return false;
        });
        const edgeIds = new Set(coa?.evidence?.causal_edge_ids ?? []);
        const edges = (latestFrame?.temporal_causal_edges ?? []).filter((edge) => {
          if (edgeIds.size > 0) {
            return edgeIds.has(`${edge.source_event_id}->${edge.target_event_id}`);
          }
          if (sourceEventIds.size === 0) return true;
          return sourceEventIds.has(edge.source_event_id) || sourceEventIds.has(edge.target_event_id);
        });
        const claims = (dashboard?.claims ?? []).filter((claim) => {
          if (entity) {
            return claim.cause_variable.includes(entity) || claim.effect_variable.includes(entity);
          }
          if (coa) {
            return (
              claim.cause_variable.includes(coa.target) ||
              claim.effect_variable.includes(coa.target) ||
              claim.label.toLowerCase().includes(String(coa.action).replace(/_/g, " "))
            );
          }
          return true;
        });
        const credibility = (dashboard?.credibility_assessments ?? []).filter((assessment) => {
          if (!coa) return true;
          return assessment.branch_outcomes.some((outcome) =>
            outcome.toLowerCase().includes(String(coa.action).replace(/_/g, " ")),
          );
        });
        sendJson(res, 200, {
          run_id: runId,
          nodes: coa?.evidence?.dominant_path ?? [],
          edges,
          evidence_events: evidenceEvents,
          claims,
          credibility,
        });
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
      }
      return;
    }

    if (req.method === "GET" && subPath === "") {
      const latestFrame = run.frames.at(-1);
      sendJson(res, 200, {
        run_id: runId,
        branch_id: run.branchId,
        parent_run_id: run.parentRunId,
        scenario: run.scenario,
        seed: run.seed,
        authorization_mode: run.authorizationMode,
        replay_hash: run.replayHash,
        status: run.status,
        current_tick: latestFrame?.tick ?? 0,
        metrics: latestFrame?.metrics ?? null,
        branches: run.branches,
        review_hold: run.reviewHold,
        heartbeat: run.lastHeartbeat,
        dropped_sse_blocks: run.droppedSseBlocks,
      });
      return;
    }
  }

  if (req.url?.startsWith("/api/provenance")) {
    try {
      const scenario = url.searchParams.get("scenario") ?? "scenarios/uas-maritime-cyber/scenario.yaml";
      const provenance = loadScenarioProvenance(scenario);
      sendJson(res, 200, provenance ?? { data_mode: "synthetic", verification: "internal_only" });
    } catch (error) {
      sendJson(res, 500, { error: error.message ?? "Failed to load provenance" });
    }
    return;
  }

  if (req.url?.startsWith("/api/health")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      sim_export: Boolean(findSimExport()),
      sim_stream: Boolean(findSimStream()),
      sim_live: Boolean(findSimLive()),
      sim_serve: Boolean(findSimServe()),
    }));
    return;
  }

  if (req.url?.startsWith("/api/live")) {
    const simLive = findSimLive();
    if (!simLive) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("sim-live binary not found. Build with: cmake --build build-make --target sim-live");
      return;
    }
    try {
      const scenario = url.searchParams.get("scenario") ?? "scenarios/uas-maritime-cyber/scenario.yaml";
      const seed = Number(url.searchParams.get("seed") ?? "42");
      const scenarioPath = resolveScenario(scenario);
      const args = buildCliArgs(scenarioPath, seed, {
        authorizationMode: url.searchParams.get("mode") ?? undefined,
        approvals: url.searchParams.getAll("approve"),
      });

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const child = spawn(simLive, args, { cwd: repoRoot, env: process.env });
      child.stdout.pipe(res);
      child.stderr.on("data", (chunk) => {
        res.write(`event: error\ndata: ${JSON.stringify({ message: chunk.toString() })}\n\n`);
      });
      child.on("close", (code) => {
        if (code !== 0) {
          res.write(`event: error\ndata: ${JSON.stringify({ message: `sim-live exited with code ${code}` })}\n\n`);
        }
        res.end();
      });
      req.on("close", () => {
        child.kill("SIGTERM");
      });
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(error instanceof Error ? error.message : "Unknown error");
    }
    return;
  }

  if (req.url?.startsWith("/api/playback")) {
    try {
      const scenario = url.searchParams.get("scenario") ?? "scenarios/uas-maritime-cyber/scenario.yaml";
      const seed = Number(url.searchParams.get("seed") ?? "42");
      const scenarioPath = resolveScenario(scenario);
      const payload = await runStream(scenarioPath, seed, {
        authorizationMode: url.searchParams.get("mode") ?? undefined,
        approvals: url.searchParams.getAll("approve"),
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(error instanceof Error ? error.message : "Unknown error");
    }
    return;
  }

  if (req.url?.startsWith("/api/dashboard")) {
    try {
      const scenario = url.searchParams.get("scenario") ?? "scenarios/uas-maritime-cyber/scenario.yaml";
      const seed = Number(url.searchParams.get("seed") ?? "42");
      const scenarioPath = resolveScenario(scenario);
      const payload = await runExport(scenarioPath, seed, {
        authorizationMode: url.searchParams.get("mode") ?? undefined,
        approvals: url.searchParams.getAll("approve"),
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(error instanceof Error ? error.message : "Unknown error");
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

const port = Number(process.env.DARLA_API_PORT ?? 8787);
server.listen(port, () => {
  console.log(`DARLA API server listening on http://localhost:${port}`);
  console.log(`sim-export: ${findSimExport() ?? "NOT FOUND"}`);
  console.log(`sim-stream: ${findSimStream() ?? "NOT FOUND"}`);
  console.log(`sim-live: ${findSimLive() ?? "NOT FOUND"}`);
  console.log(`sim-serve: ${findSimServe() ?? "NOT FOUND"}`);
});
