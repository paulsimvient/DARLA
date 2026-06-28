# DARLA Causal-Agentic LVC Prototype

This repository contains a first working milestone for a deterministic, headless C++20 causal simulation prototype. It implements the UAS maritime ISR cyber/comms micro-world described in the build export document.

## Build

```sh
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Debug
cmake --build build
ctest --test-dir build --output-on-failure
```

If Ninja is not installed:

```sh
cmake -S . -B build-make -G "Unix Makefiles" -DCMAKE_BUILD_TYPE=Debug
cmake --build build-make
ctest --test-dir build-make --output-on-failure
```

Sanitizer build support is available with:

```sh
cmake -S . -B build-asan -G "Unix Makefiles" -DCMAKE_BUILD_TYPE=Debug -DDARLA_ENABLE_SANITIZERS=ON
cmake --build build-asan
ctest --test-dir build-asan --output-on-failure
```

## Run

```sh
./build/sim-runner scenarios/uas-maritime-cyber/scenario.yaml --seed 42
```

For the Makefiles build directory, use `./build-make/sim-runner`.

## Tools

Export a deterministic event ledger from the baseline run:

```sh
./build/sim-runner scenarios/uas-maritime-cyber/scenario.yaml --seed 42 --out run_42.events
```

Verify an exported ledger hash:

```sh
./build/sim-replay run_42.events --verify-hash
```

Run only the counterfactual branch report:

```sh
./build/sim-counterfactual scenarios/uas-maritime-cyber/scenario.yaml --seed 42 --at 760 --intervention isolate_compromised_sensor_feed
```

Supported interventions are `isolate_compromised_sensor_feed`, `restore_comms_relay`, `remove_logistics_delay`, `enable_autonomous_search`, and `pre_authorize_engagement`.

Interventions are scheduled into the branch and applied only when simulation time reaches `--at`. Early intervention recovers the branch, partial intervention can still improve if it arrives before the mission cutoff, and late intervention cannot rewrite prior detection or mission failure.

Run deterministic replay and event-ledger integrity checks:

```sh
./build/sim-verify scenarios/uas-maritime-cyber/scenario.yaml --seed 42
```

`sim-verify` also enforces event-ledger temporal integrity, evaluates causal claims through the MVP credibility runtime, runs executable falsification branches, and reports the credibility contract, model-risk rigor level, falsification outcome, and whether each claim is reportable for the current validity envelope.

Run the optional real-time agent loop demo:

```sh
./build/sim-agent-demo scenarios/uas-maritime-cyber/scenario.yaml --seed 42
```

This compares the baseline run against an online-agent run. The fast loop lets `BlueCommanderAgent` observe degraded sensing/comms, query the `CausalActionEstimator` over the typed `RelationshipGraph`, choose `isolate_compromised_sensor_feed`, and schedule the intervention. The slow loop then validates the decision with replay/falsification branches.

## Phase A: Structural Causal Foundation

Phase A adds the first structural causal layer beyond hard-coded commander scores:

- `RelationshipGraph` — typed agent/entity edges (`commands`, `depends_on`, `senses`, `degrades`, `communicates_with`, `supplies`) loaded from `scenario.yaml`
- `CausalActionEstimator` — runs bounded counterfactual branches via `InterventionEngine` to produce `estimateActionEffect(...)` for each candidate action
- `BlueCommanderAgent` — builds candidates from relationship edges and selects the best **supported** action by causal merit; refuses unsupported actions and holds COA when evidence is weak

Example relationship edges in the maritime micro-world:

```yaml
relationships:
  - type: commands
    source: blue_commander
    target: blue_uas_1
  - type: degrades
    source: red_cyber_actor
    target: blue_uas_1
    component: sensor
```

## Phase C: Scientific Rigor Layer

Phase C moves credibility and claims out of hard-coded C++ and into executable scientific artifacts:

- **Typed causal variables** — claims reference variables like `blue_uas_1.sensor.confidence`, `detection_time`, and `mission_success_score` instead of event labels alone
- **Versioned credibility contracts** — YAML models under `models/` (`sensor-confidence-v0.yaml`, `mission-effects-v0.yaml`, etc.)
- **Planted causal truth scoring** — `planted_causal_truth` edges from scenario YAML are scored against recovered claims
- **Metric-based emergence** — `EmergenceDetector` identifies tempo collapse, sensor trust collapse, and comms cascade from runtime metrics
- **Async slow-loop validation** — after online agent decisions, the slow loop runs falsification, minimum intervention search, and planted-truth scoring

Example planted truth in scenario YAML:

```yaml
planted_causal_truth:
  edges:
    - red_cyber_actor.degrade_sensor_feed -> blue_uas_1.sensor_confidence_loss
    - blue_uas_1.sensor_confidence_loss -> delayed_target_detection
```

Run verification with planted truth recovery and YAML-backed credibility:

```sh
./build/sim-verify scenarios/uas-maritime-cyber/scenario.yaml --seed 42
```

Run brute-force minimum intervention search over current singleton and pair actions:

```sh
./build/sim-search scenarios/uas-maritime-cyber/scenario.yaml --seed 42
```

The search reports both the lowest-cost effective intervention and the best mission-effect intervention. In the current micro-world, sensor isolation is the lowest-cost effective singleton, while `isolate_compromised_sensor_feed + enable_autonomous_search` produces the best mission score and earliest detection.

## Dual-Loop Runtime

The prototype now separates real-time decision support from deeper causal science:

- Fast loop: agents observe state, query bounded causal estimates, score candidate actions, select an action, execute through the adjudicator, and log evidence.
- Slow loop: replay and falsification branches test whether the online causal assumption survived counterfactual checks.

The first implemented heterogeneous-agent slice includes `RedCyberAgent`, `SensorAgent`, `CommsAgent`, `BlueUASAgent`, `LogisticsAgent`, and `BlueCommanderAgent`. Additional agent types such as Adversary and HumanCommand remain planned.

### Comms-only scenario

A second scenario exercises comms-only degradation with a healthy sensor feed:

```sh
./build/sim-runner scenarios/uas-maritime-cyber/comms-only.yaml --seed 42
```

In this branch, restoring comms alone recovers mission timing while sensor isolation is not the right response.

## Credibility Runtime

The `sim-credibility` module implements the first executable VV&A slice:

- `CredibilityContract` declares intended use, valid/invalid conditions, assumptions, scores, and known failure modes.
- `ModelRisk` computes `decision influence x consequence of error` and escalates required rigor.
- `FalsificationResult` records whether executable branch checks survived or overturned a claim.
- `CredibilityAssessment` combines evidence, confidence, contract scores, and falsification status into a reportable claim decision.

The logistics-delay confounder is intentionally correlated with mission failure but is overturned as a causal explanation. The executable falsification pass currently runs three branch probes for the MVP claims:

- `restore_sensor` verifies that restoring sensor confidence changes detection and mission outcome.
- `restore_comms` verifies that restoring comms alone does not recover the mission.
- `remove_logistics` verifies that suppressing the logistics delay does not recover the mission.

## Current Rigor Boundaries

The prototype now has time-faithful scheduled intervention behavior, event-ledger temporal validation, executable falsification branches for the MVP causal claims, a typed relationship graph, a causal action estimator for online commander decisions, typed causal variables and YAML credibility contracts, planted causal truth scoring, metric-based emergence detection, async slow-loop validation, an optional real-time heterogeneous-agent decision loop, sanitizer build support, a counterfactual CLI that can select among the current intervention types, and brute-force minimum intervention search over singletons and pairs. Remaining DARPA-hard gaps are still explicit: full adaptive adversary behavior is not implemented, causal discovery is still partially label-assisted, and full VV&A tooling remains out of scope.

The prototype keeps Unreal, LVC adapters, LLM agents, and full VV&A tooling out of scope. The C++ kernel owns state transitions, event evidence, deterministic replay, causal claims, snapshots, credibility assessments, and the `do(isolate_compromised_sensor_feed)` counterfactual branch.

## Web Dashboard

A React dashboard visualizes the dual-loop causal runtime: baseline vs online-agent metrics, agent relationship graph, event timeline, causal claims with credibility assessments, minimum intervention search, planted truth recovery, and async slow-loop validation.

### Build the export tool

```sh
cmake --build build-make   # or build/
```

### Run the dashboard

```sh
cd frontend
npm install
npm run dev
```

This starts:
- API server on `http://localhost:8787` (spawns `sim-export`)
- Vite dev UI on `http://localhost:5173`

Open the Vite URL in your browser. Use the controls to pick a scenario and seed, then click **Run Simulation**.

## Phase D: Always-On Agent Runtime

Phase D replaces one-shot agent flags with persistent belief state and continuous per-tick participation:

- **AgentBeliefRegistry** — per-agent memory (sensor trust, comms health, mission risk, causal warnings, credibility envelope)
- **Always-on sensing** — agents run every tick when `realtime_agents_enabled`; emit `*_monitoring` every 120 ticks
- **Anomaly detection** — `*_anomaly` events when thresholds crossed (sensor trust collapse, comms relevance)
- **CausalMonitorAgent** — scans causal path strength every 60 ticks; emits `causal_monitor_warning`
- **CredibilityAgent** — monitors validity envelope; emits `credibility_monitoring` or `credibility_violation`
- **BlueCommanderAgent** — continuous mission risk monitoring; acts once when causal threshold met; refuses otherwise

Agents continuously observe, evaluate, and prepare — they do not constantly mutate the world.

## Agentic C++ Framework (`sim-agents`)

Heterogeneous agents run through a small agentic framework:

- **`SimulationAgent`** — abstract agent interface (`id`, `phase`, `authority`, `priority`, `tick()`)
- **`AgentRegistry`** — registers agents and runs them in stable priority order
- **`AgentOrchestrator`** — executes pre-cyber and post-cyber phases each tick
- **`AgentRuntime`** — simulation integration layer used by `MicroWorldAdjudicator`
- **`registerMaritimeMicroWorldAgents()`** — binds RedCyber, Sensor, Comms, UAS, Logistics, CausalMonitor, Credibility, and Commander agents

Tick loop inside adjudication:

```text
pre-cyber phase  -> RedCyberAgent
cyber adjudication
post-cyber phase -> Sensor, Comms, UAS, Logistics, CausalMonitor, Credibility, Commander
```

Each binding wraps the always-on agent implementation and returns an `AgentTickResult` (sensed, monitoring, anomaly, action).

The dashboard includes a **MapLibre** operational map showing geolocated entities, sensor range circles, and relationship links (Taiwan Strait micro-world). Entity coordinates are defined in scenario YAML under `components.kinematic`.

**Simulation playback** — tick-by-tick play/pause/scrub over the online-agent run. Sensor state, agent beliefs, and metrics update on the map as cyber events unfold. Build `sim-stream` alongside `sim-export`:

```sh
cmake --build build-make --target sim-export sim-stream
```

### Export JSON manually

```sh
./build-make/sim-export scenarios/uas-maritime-cyber/scenario.yaml --seed 42 --out dashboard.json
```
