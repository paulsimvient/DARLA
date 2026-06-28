import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

/** @typedef {{ id: string, scenario: string, seed: number, authorizationMode: string, branchId: string, parentRunId: string | null, background: boolean, child: import("node:child_process").ChildProcessWithoutNullStreams, events: object[], frames: object[], commands: object[], branches: object[], replayHash: string | null, status: string, createdAt: number, dashboardCache: object | null, dashboardCachePromise: Promise<object> | null }} SimRun */

/** @type {Map<string, SimRun>} */
const runs = new Map();

function findBinary(name) {
  const candidates = [
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
  authorizationMode = "human_hold",
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
  const text = chunk.toString();
  const blocks = text.split("\n\n");
  for (const block of blocks) {
    if (!block.trim()) continue;
    let eventName = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      if (line.startsWith("data:")) data = line.slice(5).trim();
    }
    if (!data) continue;
    try {
      const payload = JSON.parse(data);
      if (eventName === "tick") {
        run.frames.push(payload);
        if (payload.replay_hash) run.replayHash = String(payload.replay_hash);
        for (const event of payload.events ?? []) {
          run.events.push(event);
        }
        run.status = "live";
      } else if (eventName === "meta") {
        if (payload.replay_hash) run.replayHash = String(payload.replay_hash);
        run.status = "live";
      } else if (eventName === "done") {
        if (payload.replay_hash) run.replayHash = String(payload.replay_hash);
        run.status = "completed";
      } else if (eventName === "command") {
        run.commands.push(payload);
      }
    } catch {
      // ignore malformed SSE payloads
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
      const authorizationMode = body.authorization_mode ?? "human_hold";
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
          if (event.label === "human_approved_coa" || event.label === "coa_recommendation") return true;
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
