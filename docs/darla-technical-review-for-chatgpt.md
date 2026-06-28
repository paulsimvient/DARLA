# DARLA — Technical Review Document for External Review

**Project:** DARLA (Deterministic Agentic Runtime for Live Analysis)  
**Repository:** C++20 headless causal simulation prototype + React dashboard  
**Primary scenario:** `scenarios/uas-maritime-cyber/scenario.yaml` (`uas-maritime-cyber-v001`)  
**Document purpose:** Self-contained technical brief for external review (e.g., ChatGPT, DARPA reviewers, peer scientists). No codebase access required.

**Related deep-dive:** `docs/darpa-accurate-causal-slice-review.md` (SCM + identification + Monte-Carlo estimation slice)

---

## How to use this document

Paste the full document into a review session and ask the reviewer to answer the prompts in **Section 12**. Use **Section 15** for DARPA-safe claim language. The document is structured so a reviewer can assess:

1. Whether the system’s causal claims are scientifically defensible
2. Whether engineering tradeoffs undermine or support those claims
3. What gaps remain before this prototype could support operational decision-making

---

## 1. Executive summary

DARLA is a **deterministic, headless C++20 simulation** modeling a maritime UAS ISR mission degraded by cyber attack. Its core question:

> When sensing or communications fail mid-mission, **which intervention is causally justified**, **under what authority**, and **can that claim survive executable falsification**?

Unlike a traditional wargame, DARLA treats simulation as an **evidence-producing causal experimentation instrument**:

- Every state transition is recorded in an append-only **event ledger**
- Causal relationships are represented in a **temporal causal graph** and typed **relationship graph** (YAML-loaded)
- Online agents observe degraded state, query bounded counterfactual branches, propose **courses of action (COAs)**, and schedule interventions when authorized
- A separate **slow loop** replays and falsifies decisions asynchronously, scoring them against **planted causal truth** and **credibility contracts**
- Unsupported recommendations are **downgraded or refused** — the system is designed to say **no**

A React dashboard visualizes the dual-loop runtime. The C++ kernel owns truth: state, events, replay hash, counterfactual branches, and credibility assessments.

### Current verification snapshot (seed 42, uas-maritime-cyber)

**Use the canonical harness row for external briefings.** Dashboard export uses a smaller calibration config and can diverge materially (see Section 11.4).

| Metric | Canonical (`sim-calibrate`) | Dashboard (`sim-export`) |
|--------|----------------------------|--------------------------|
| Config | `--seeds 60 --ci-experiments 30` | hardcoded 24×4 regimes, 12×16 CI |
| Unit tests | All pass (49 acceptance tests, ~131s runtime) | — |
| Replay hash | `5825267991280241626` | same |
| Baseline detection time | T+1980 (cutoff T+1800 → failure) | same |
| Planted-DAG P / R / F1 | 1.0 / 1.0 / 1.0 | 1.0 / 1.0 / 1.0 |
| SHD | 0 | 0 |
| Brier | 0.0232 | 0.0194 |
| ECE | 0.0134 | 0.0092 |
| 90% CI coverage | **0.90** (30 experiments) | **0.75** (12 experiments) |
| True chain effect τ | 0.1897 | 0.1897 |

**Interpretation:** Perfect graph recovery validates **pipeline fidelity against YAML-declared ground truth**, not unassisted causal discovery. CI coverage at 27/30 is consistent with true coverage anywhere from ~0.74 to ~0.97 (Wilson 95% interval); treat 0.90 as suggestive, not proven at n=30.

---

## 2. Problem domain

### 2.1 Operational scenario

Blue forces operate a UAS (`blue_uas_1`) to detect and track a red maritime target in the Taiwan Strait micro-world. At tick 720, a red cyber actor degrades the UAS sensor feed (−0.45 confidence). This delays target detection past the mission cutoff (tick 1800), causing mission failure.

Blue commander agents must decide whether to intervene — e.g., isolate the compromised sensor feed, restore comms, enable autonomous search, or pre-authorize engagement — based on **causal evidence**, not narrative reasoning.

### 2.2 Confounder (red herring)

A **logistics delay** (`logistics_support_node → blue_commander`) is correlated with mission failure but is **not** on the planted causal path. The system must correctly report logistics → mission as **Confounded** and reject it via falsification branches.

### 2.3 Planted causal truth

From scenario YAML:

```
red_cyber_actor.degrade_sensor_feed
  → blue_uas_1.sensor_confidence_loss
  → delayed_target_detection
  → mission_failure_probability
```

---

## 3. System architecture

### 3.1 Module dependency graph

```
sim_events          Event ledger (append-only, temporal integrity)
    ↓
sim_graph           TemporalCausalGraph, RelationshipGraph
    ↓
sim_core            SimulationKernel, ScenarioLoader, StructuralCausalModel
    ↓
sim_fmi             FMI co-simulation stubs (optional FMIL)
    ↓
sim_adjudication    MicroWorldAdjudicator, EmergenceDetector
    ↓
sim_agents          Agent framework, maritime agent bindings
    ↓
sim_causal          Identification, effect estimation, claim builder, calibration
    ↓
sim_credibility     Credibility contracts, falsification, async validation
    ↓
sim_tools           ScenarioRunner, SimFrameExporter, SimCommandProcessor
    ↓
CLI tools           sim-runner, sim-verify, sim-export, sim-calibrate, ...
```

**Design constraint:** `sim_adjudication` cannot link `sim_causal` (CMake DAG: `sim_core → sim_adjudication`; `sim_causal → sim_core`). The **Structural Causal Model (SCM)** therefore lives in `sim-core`, consumed by both adjudicator and causal modules.

### 3.2 Dual-loop runtime

```
┌─────────────────────────────────────────────────────────────┐
│ FAST LOOP (per tick)                                        │
│  AgentRuntime → observe → CausalActionEstimator → decide    │
│  → schedule intervention → MicroWorldAdjudicator → ledger   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ SLOW LOOP (async, post-decision)                            │
│  Replay → falsification branches → minimum intervention     │
│  search → planted truth scoring → credibility assessment    │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Per-tick adjudication flow

```
pre-cyber phase  → RedCyberAgent
cyber adjudication (scripted events, sensor degradation)
post-cyber phase → Sensor, Comms, UAS, Logistics, CausalMonitor,
                   Credibility, Commander agents
SCM-driven detection/mission scoring (MicroWorldAdjudicator)
Event ledger append
```

---

## 4. Causal inference pipeline

The causal slice was converted from **declared constants** (hardcoded detection ticks, mission scores, effect sizes) into a four-stage pipeline:

### 4.1 Structural Causal Model (SCM)

**Location:** `sim-core/include/StructuralCausalModel.h`, `sim-core/src/StructuralCausalModel.cpp`

| Variable | Symbol | Role |
|----------|--------|------|
| `red_cyber_actor.degrade_sensor_feed` | X | Treatment |
| `blue_uas_1.sensor.confidence` | S | Mediator |
| `detection_time` | D | Mediator |
| `mission_success_score` | M | Outcome |
| `logistics.delay` | L | Correlated non-causal confounder |
| Shared tempo / commander risk | U | Latent confounder on D–M path |

**Structural equations (discrete-regime SCM):**

- **Sensor:** `β_cyber` from θ; noise `U_S ~ Normal(0, σ_S)` when stochastic mode enabled
- **Detection:** Structural mean from discrete inputs `(degraded, isolated, autonomous, comms_blocking)` → θ ladder values; plus `U_D ~ Normal(0, σ_D)` in stochastic mode
- **Mission:** Structural mean from `(success, autonomous, isolated, preauthorized, high_confidence)` → θ scores; plus `U_M` in stochastic mode
- **Closed-form probability:** `P(D ≤ cutoff)` via Gaussian CDF on detection noise

**Backward compatibility:** Noise-free means reproduce the legacy ladder exactly (deterministic replay unchanged). Stochastic noise is used for Monte-Carlo estimation and calibration, not default baseline runs.

**YAML parameters (`scm:` block):**

```yaml
scm:
  sensor_beta_cyber: -0.45
  sensor_sigma: 0.05
  detection_nominal: 1400
  detection_comms_blocking: 1900
  detection_degraded: 1980
  detection_degraded_autonomous: 1700
  detection_isolated: 1440
  detection_isolated_autonomous: 1320
  detection_sigma: 60
  mission_fail_score: 0.42
  mission_success_score: 0.61
  mission_success_autonomous_isolated: 0.68
  mission_preauth_floor: 0.67
  mission_sigma: 0.05
  latent_confounder_strength: 0.18
```

### 4.2 Identification (do-calculus)

**Location:** `sim-causal/src/Identification.cpp`

- Builds DAG from `planted_causal_truth` edges
- Path enumeration, d-separation, back-door criterion
- Exhaustive subset search over observed nodes for minimal back-door adjustment sets
- Derives `ClaimStatus` per estimand

| Estimand | Expected `ClaimStatus` | Rationale |
|----------|------------------------|-----------|
| cyber → sensor | `DirectlyAdjudicated` | Direct manipulation + observed edge |
| sensor → detection | `Identifiable` | Directed path; empty admissible back-door set |
| detection → mission | `WeaklyIdentifiable` | Latent opens back-door; partial identification |
| logistics → mission | `Confounded` | No directed path in planted DAG |

### 4.3 Effect estimation

**Location:** `sim-causal/src/CausalEffectEstimator.cpp`

- Paired Monte-Carlo branches with `do()` interventions
- Independent noise sub-seeds (`2n`, `2n+1`) per replicate to avoid common-random-number cancellation
- Bootstrap CI, `P(τ > 0)`, Chinn/E-value sensitivity
- Closed-form `estimateStructuralContrast` when no snapshot provided

**Mixed-mode behavior:** `CausalClaimBuilder` uses closed-form SCM at most call sites; Monte-Carlo available when snapshot + horizon passed.

### 4.4 Claim builder

**Location:** `sim-causal/src/CausalClaimBuilder.cpp`

Populates `CausalClaim` fields (effect_size, confidence, status, sensitivity, confounders) from identifier + estimator. Preserves legacy claim labels for downstream falsification/credibility:

- `sensor_confidence_loss -> delayed_detection`
- `delayed_detection -> mission_failure`
- `logistics_delay -> mission_failure rejected`

### 4.5 Validation metrics

**PlantedTruthScorer:** precision, recall, F1, SHD, sign accuracy, effect error, CI coverage. Claims with `Confounded` or `Falsified` status are **not** counted as recovered edges.

**CalibrationHarness:** multi-regime outcome calibration; Brier, log-loss, ECE, reliability bins, CI coverage experiments, full-run graph recovery.

---

## 5. Agent runtime

### 5.1 Agent framework (`sim-agents`)

| Component | Role |
|-----------|------|
| `SimulationAgent` | Abstract interface (`id`, `phase`, `authority`, `priority`, `tick()`) |
| `AgentRegistry` | Registers agents; stable priority ordering |
| `AgentOrchestrator` | Pre-cyber and post-cyber phases each tick |
| `AgentRuntime` | Simulation integration via `MicroWorldAdjudicator` |
| `registerMaritimeMicroWorldAgents()` | Binds all maritime micro-world agents |

### 5.2 Registered agents

| Agent | Phase | Behavior |
|-------|-------|----------|
| RedCyberAgent | pre-cyber | Executes scripted cyber degradation |
| SensorAgent | post-cyber | Monitors sensor trust; emits anomalies |
| CommsAgent | post-cyber | Monitors comms health |
| BlueUASAgent | post-cyber | UAS platform behavior |
| LogisticsAgent | post-cyber | Logistics delay correlation |
| CausalMonitorAgent | post-cyber | Scans causal path strength every 60 ticks |
| CredibilityAgent | post-cyber | Monitors validity envelope |
| BlueCommanderAgent | post-cyber | Continuous mission risk monitoring; acts once when causal threshold met; refuses otherwise |

### 5.3 Agent belief state (Phase D)

`AgentBeliefRegistry` tracks per-agent memory: sensor trust, comms health, mission risk, causal warnings, credibility envelope. Agents continuously observe and evaluate — they do not constantly mutate the world.

### 5.4 Commander decision logic

`BlueCommanderAgent` uses `CausalActionEstimator` over the typed `RelationshipGraph` to rank candidate actions by causal merit. Unsupported actions are refused. In the sensor-degraded scenario, `isolate_compromised_sensor_feed` is selected; in comms-only scenario, `restore_comms_relay` is selected.

---

## 6. Credibility and VV&A

### 6.1 Credibility contracts

YAML models under `models/`:

- `sensor-confidence-v0.yaml`
- `commander-policy-v0.yaml`
- `comms-effects-v0.yaml`
- `mission-effects-v0.yaml`
- `logistics-effects-v0.yaml`

Each contract declares: intended use, valid/invalid conditions, assumptions, scores, known failure modes.

### 6.2 Falsification branches (MVP)

Three executable branch probes per claim:

| Branch | Purpose |
|--------|---------|
| `restore_sensor` | Verify restoring sensor confidence changes detection and mission outcome |
| `restore_comms` | Verify restoring comms alone does **not** recover the mission (sensor-degraded scenario) |
| `remove_logistics` | Verify suppressing logistics delay does **not** recover the mission |

### 6.3 Credibility assessment output (seed 42)

| Claim | Status | Score | Falsification |
|-------|--------|-------|---------------|
| cyber → sensor | DirectlyAdjudicated | 0.96 | Survived |
| sensor → detection | Identifiable | 0.94 | Survived |
| detection → mission | WeaklyIdentifiable | 0.94 | Survived |
| logistics → mission | Confounded | 0.57 | Overturned |

### 6.4 Model risk

`ModelRisk` computes `decision influence × consequence of error` and escalates required rigor (basic verification → SME validation + counterfactual tests).

---

## 7. Interventions and counterfactuals

### 7.1 Supported interventions

| Intervention | Effect in sensor-degraded scenario |
|--------------|-----------------------------------|
| `isolate_compromised_sensor_feed` | Recovers detection (T+1440) and improves mission score |
| `enable_autonomous_search` | Partial recovery (T+1700) |
| `restore_comms_relay` | No recovery (sensor is root cause) |
| `remove_logistics_delay` | No recovery (confounder only) |
| `pre_authorize_engagement` | Floor on mission score when detection succeeds |

Interventions are **scheduled** at a tick (`--at`) and applied only when simulation time reaches that tick. Early intervention recovers the branch; late intervention cannot rewrite prior detection.

### 7.2 Minimum intervention search

`sim-search` performs brute-force search over singleton and pair interventions. In the current micro-world: sensor isolation is lowest-cost effective singleton; `isolate + enable_autonomous_search` produces best mission score and earliest detection.

---

## 8. Event ledger and determinism

- Append-only event ledger with temporal integrity validation (no regressions)
- Stable hash (`stableHash()`) for replay verification
- Deterministic per seed: same scenario + seed → identical event sequence
- Monte-Carlo ensemble reproducible with fixed noise seeds

---

## 9. Tooling and dashboard

### 9.1 CLI tools

| Tool | Purpose |
|------|---------|
| `sim-runner` | Run baseline simulation; export event ledger |
| `sim-replay` | Verify exported ledger hash |
| `sim-counterfactual` | Run single counterfactual branch at tick |
| `sim-verify` | Determinism, ledger integrity, planted truth, credibility |
| `sim-agent-demo` | Compare baseline vs online-agent run |
| `sim-search` | Minimum intervention search |
| `sim-export` | Dashboard JSON (includes calibration block) |
| `sim-calibrate` | Multi-seed calibration report |
| `sim-stream` | Tick-by-tick streaming for dashboard playback |
| `sim-live` / `sim-serve` | Live runtime API for dashboard |

### 9.2 Dashboard (React + Vite)

- MapLibre operational map (Taiwan Strait entities, sensor ranges, relationship links)
- Baseline vs online-agent metrics
- Agent relationship graph, event timeline
- Causal claims with credibility assessments
- Minimum intervention search, planted truth recovery
- Tick-by-tick playback (via `sim-stream`)

API server on `:8787` (spawns `sim-export`); UI on `:5173`.

---

## 10. Test coverage

49 acceptance tests in `tests/unit/main.cpp`, including:

| Category | Tests |
|----------|-------|
| Determinism / replay | `deterministicReplayHashMatches`, `exportedLedgerHashMatchesBody` |
| Counterfactuals | `counterfactualImprovesMissionScore`, `interventionTimingIsCausal` |
| Credibility | `credibilityAssessmentsRejectFalseCause`, `falsificationBranchesTestAlternates` |
| Agents | `realtimeAgentChoosesCausalAction`, `agentHoldsWhenCausalSupportIsWeak`, `alwaysOnAgentsEmitMonitoring` |
| Scenarios | `commsOnlyScenarioFailsWithoutIntervention`, `taiwanOpenDataDeterministicReplayMatchesGolden` |
| Causal science | `identificationDerivesClaimStatuses`, `monteCarloEnsembleIsReproducible`, `calibrationHarnessMeetsAccuracyThresholds` |
| COA lifecycle | `coaLifecycleCompletesAfterDetection`, `explicitApprovalsReproduceRecoveryWhenApproved` |
| Infrastructure | `fmuConfigParsesAndStepsStub`, `pythonScriptComponentParsesFromScenario`, `executionBudgetsTrackAgentDecisions` |

**Run:**

```bash
cmake --build build-make --target darla_tests
./build-make/darla_tests

cmake --build build-make --target sim-verify
./build-make/sim-verify scenarios/uas-maritime-cyber/scenario.yaml --seed 42

cmake --build build-make --target sim-calibrate
./build-make/sim-calibrate scenarios/uas-maritime-cyber/scenario.yaml --seeds 60 --ci-experiments 30
```

---

## 11. Maturity boundaries and known limitations

### 11.1 In scope (demonstrated in micro-world)

These are **implementation-fidelity** capabilities, not claims of operational causal discovery:

- Deterministic headless simulation with append-only event ledger and stable replay hash
- Typed relationship graph and bounded counterfactual action estimation
- Executable falsification branches for MVP claims (sensor restore, comms restore, logistics removal)
- Planted-truth scoring (precision/recall/F1/SHD) against YAML-declared edges
- SCM + back-door identification + Monte-Carlo estimation with a dedicated calibration harness
- Always-on heterogeneous agent runtime with belief state and refusal of unsupported COAs
- Async slow-loop validation (replay, falsification, planted-truth check) decoupled from fast-loop decisions
- Brute-force minimum intervention search (singletons + pairs)
- React dashboard with map, playback, claims panel
- Optional FMI stubs and Python script components

**What perfect planted-DAG scores actually prove:** The identifier, claim builder, scorer, and falsification pipeline are wired correctly for the declared 3-edge chain plus the logistics red herring. They do **not** prove that DARLA can discover causal structure without planted labels.

### 11.2 Out of scope / not yet built

- Unreal / full LVC adapters
- LLM agents
- Full adaptive adversary behavior (red cyber is scripted at T+720)
- Unassisted causal discovery (identifier consumes `planted_causal_truth` from YAML)
- Full VV&A tooling at scale (no multi-scenario benchmark suite, no blind hold-out)
- Continuous (non-ladder) detection model
- Quantitative partial-identification bounds for weakly identifiable estimands
- Latent confounder **simulation** in the deterministic baseline path

### 11.3 Engineering tradeoffs (with code evidence)

| # | Tradeoff | Evidence | Reviewer-safe framing |
|---|----------|----------|----------------------|
| 1 | **Discrete-regime SCM** | `detectionTickMean()` is a piecewise ladder keyed by intervention flags (`StructuralCausalModel.cpp`); Gaussian noise overlays the mean in stochastic mode | Valid explicit SCM for a prototype; not a continuous physics model |
| 2 | **Latent confounder is declarative** | `latent_confounder_strength` downgrades D→M to `WeaklyIdentifiable` in `CausalClaimBuilder.cpp` but is **never drawn** in `StructuralCausalModel.cpp`; `WorldState.scm_noise_enabled` defaults `false` | Partial ID is a **declared policy**, not yet empirically stressed |
| 3 | **Back-door only, exhaustive search** | `Identification.cpp`: d-separation + back-door criterion; `O(2^|V|)` subset search; no front-door / IV | Fine for ~5 nodes; does not scale |
| 4 | **Dual estimation modes** | Closed-form `estimateStructuralContrast` at most claim-builder call sites; Monte-Carlo when snapshot + horizon available | Acceptable if reviewers are told which path produced each number |
| 5 | **Two calibration configs** | `sim-calibrate` defaults: 120 seeds/regime, 24 CI experiments (`CalibrationHarness.h`); `sim-export` hardcodes 24 seeds, 12 CI experiments (`sim-export/main.cpp:589-591`) | **Never cite dashboard CI coverage in external briefings** |
| 6 | **Calibration object alignment** | Brier/ECE compare `probabilityDetectBeforeCutoff()` to binary `mission_success`; in adjudication, `mission_success := detection_time ≤ cutoff` (`MicroWorldAdjudicator.cpp:214`) — aligned for baseline, but track-confidence and engagement gates exist elsewhere | Mostly coherent for this slice; document the exact mapping |
| 7 | **sign_accuracy hardcoded at recovery** | `PlantedTruthScorer.cpp:76` sets `sign_accuracy = 1.0` whenever any edge matches; real sign scoring only in `scoreEffectAccuracy()` | Do not cite recovery-time sign_accuracy externally; use effect-accuracy path |
| 8 | **Planted-truth circularity** | `CausalIdentifier` is constructed from `world.planted_truth` (`CausalClaimBuilder.cpp:123`); claims inherit those statuses | Reframe as VV&A wiring test, not discovery |
| 9 | **Fast vs slow loop** | Commander decides via `ActionEffectEstimator` in fast loop; `AsyncValidationRuntime` falsifies **after** decision (`AsyncValidationRuntime.cpp`) | Credibility is audit-grade, not a hard gate on first action |
| 10 | **Comms-only scenario** | `comms-only.yaml` has no `planted_causal_truth` block | Recovery metrics are scenario-specific; do not aggregate blindly |

### 11.4 Measured metric divergence (verified 2026-06-28)

Run canonical harness:

```bash
./build-make/sim-calibrate scenarios/uas-maritime-cyber/scenario.yaml --seeds 60 --ci-experiments 30
```

Run dashboard export (smaller config):

```bash
./build-make/sim-export scenarios/uas-maritime-cyber/scenario.yaml --out /tmp/export.json
```

| Metric | Canonical harness | Dashboard export | Notes |
|--------|-------------------|------------------|-------|
| Outcome samples | 240 (60×4 regimes) | 96 (24×4) | Brier can look better with fewer samples |
| Brier | 0.0232 | 0.0194 | Both well-calibrated; not contradictory |
| ECE | 0.0134 | 0.0092 | Same |
| 90% CI coverage | **0.90** (30 expts) | **0.75** (12 expts) | **Material divergence** — dashboard understates coverage |
| Wilson 95% CI on true coverage | [0.74, 0.97] for 27/30 | [0.46, 0.91] for 9/12 | Neither run proves nominal 0.90 at conventional power |

Unit-test acceptance threshold for CI coverage is only `≥ 0.6` with 12 experiments (`tests/unit/main.cpp:901`) — much weaker than the headline 0.90 figure.

### 11.5 Expected external-review verdict

**Defensible today:** DARLA is a deterministic causal experimentation instrument for a maritime cyber vertical slice — replay, falsification, calibration harness, credibility contracts, and agent refusal are real and tested.

**Not yet defensible:** Claims of operational causal discovery, adaptive-adversary resilience, or multi-scenario generalization.

**Primary overclaiming risk:** Citing perfect planted-DAG recovery or dashboard calibration numbers as evidence of scientific discovery rather than implementation fidelity.

### 11.6 Pre-DARPA / external-review fixes (priority order)

1. **Claims discipline** — adopt Section 15 language; stop citing dashboard CI coverage externally.
2. **Metric honesty** — fix or stop exporting hardcoded `sign_accuracy = 1.0` in `PlantedTruthScorer::score()`.
3. **Coverage validation** — increase `ci_experiments` to ≥200 or report binomial CIs alongside point estimates.
4. **Latent confounder** — either simulate U in stochastic replay or soften weak-ID rhetoric to "declared under stated latent."
5. **Blind evaluation** — second scenario with hold-out planted truth not wired into the identifier input.
6. **Unify canonicalization** — single alias table shared by identifier, scorer, and claim builder.

---

## 12. External review guide

Section 12 serves two audiences: (1) paste the **prompts** into an independent review session; (2) use the **expected findings** below as a pre-read sanity check. Expected findings are grounded in code review and measured runs — not a substitute for independent review.

### A. Mathematical rigor

**Prompt:** Does the pipeline constitute a defensible SCM + identification + estimation stack for the vertical slice (`cyber → sensor → detection → mission`)? What gaps remain vs Pearl-style causal inference? Is the discrete-regime detection ladder a valid structural model or merely a lookup table with noise?

**Expected finding:** Defensible as an **explicit discrete-regime SCM** with exogenous noise — not as a discovered or continuous structural form. Gaps vs Pearl: back-door only (no front-door/IV/do-calculus beyond adjustment), no quantitative partial-ID bounds, latent U declared but not simulated in baseline.

### B. Identification correctness

**Prompt:** Verify the back-door criterion implementation against the planted DAG and latent D–M confounder. Is `WeaklyIdentifiable` vs `Confounded` assignment correct for logistics → mission? Edge cases for exhaustive search?

**Expected finding:** Assignments are **correct for the declared DAG**:

| Estimand | Status | Rationale |
|----------|--------|-----------|
| cyber → sensor | `DirectlyAdjudicated` | Direct manipulation + observed edge |
| sensor → detection | `Identifiable` | Directed path; empty admissible back-door set |
| detection → mission | `WeaklyIdentifiable` | Declared latent on (D, M) opens back-door |
| logistics → mission | `Confounded` | No directed path in planted DAG |

Edge-case risks: scale (`O(2^|V|)`), hand-declared latents, hand-maintained `canonical()` aliases, no selection/M-bias handling.

### C. Uncertainty quantification and calibration

**Prompt:** Are Brier/ECE computed on the right object? Is bootstrap CI methodology sound? Is 90% coverage at 0.90 with 30 experiments meaningful?

**Expected finding:** Brier/ECE target `P(detect before cutoff)` vs `mission_success` — **aligned in adjudication** (`detection_time ≤ cutoff`). Bootstrap over paired branch diffs with independent noise seeds is sound. **0.90 at n=30 is not statistically conclusive** (Wilson 95% CI ≈ [0.74, 0.97]); P(≥27/30 | p=0.90) ≈ 0.65.

### D. VV&A metrics

**Prompt:** Are precision/recall/F1/SHD appropriate? Alias issues? Should confounded claims be excluded from recall?

**Expected finding:** Excluding `Confounded`/`Falsified` from recovered edges is **correct** (`PlantedTruthScorer.cpp:37-38`). Perfect scores are **expected** because the identifier reads planted truth. `sign_accuracy` at recovery time is **misleading** (hardcoded 1.0). SHD ignores orientation errors because claim direction is fixed.

### E. Regression safety vs scientific accuracy

**Prompt:** Is noise-free SCM backward compatibility valid, or does it undermine accuracy claims? Can reviewers trust stochastic estimates if default runs never exercise noise?

**Expected finding:** Valid engineering tradeoff for replay determinism. **Reviewer trust gap:** operational path (`sim-runner`, agents, dashboard playback) runs with `scm_noise_enabled = false`; stochastic layer is primarily in `sim-calibrate` and effect estimation. Do not conflate deterministic replay fidelity with operational UQ.

### F. Agent-causal integration

**Prompt:** Does dual-loop architecture separate concerns? Can the commander be misled? Attack surfaces?

**Expected finding:** Architecture is sound (fast decide / slow falsify). Commander **cannot select logistics interventions** — action space is gated by sensor/comms state (`Agents.cpp:652-667`), which helps this scenario but is not a general confounder defense. Fast loop acts before async falsification completes.

### G. Threats to validity

**Prompt:** Top 5 ways the system could report high credibility while being wrong in deployment; mitigations.

**Expected finding:**

| Threat | Mitigation |
|--------|------------|
| Label-assisted "discovery" (planted DAG is input) | Blind hold-out scenarios; separate discovery from validation |
| Single-scenario overfitting | Multi-scenario benchmark; report variance |
| SCM θ tuned to pass tests | Freeze θ before test-driven tuning; SME sensitivity analysis |
| Latent confounder declarative only | Simulate U in stochastic mode; report bounds |
| Scripted non-adaptive red team | Adaptive adversary policy; stress falsification under adaptation |

### H. Path to scale

**Prompt:** What must change for unassisted discovery, adaptive adversaries, multi-scenario generalization, and operational HITL?

**Expected finding:** Discovery requires removing planted truth from identifier input and scaling beyond exhaustive back-door search. Adaptive adversaries require replacing scripted events. Multi-scenario requires per-scenario planted truth (comms-only gap) and aggregated metrics. HITL requires explicit decision-vs-validation latency SLAs and audit-grade dissent logging (partial COA lifecycle exists).

---

## 13. Key file inventory

```
sim-core/
  include/StructuralCausalModel.h, WorldState.h
  src/StructuralCausalModel.cpp, SimulationKernel.cpp, ScenarioLoader.cpp

sim-adjudication/
  src/MicroWorldAdjudicator.cpp, EmergenceDetector.cpp

sim-causal/
  src/Identification.cpp, CausalEffectEstimator.cpp, CausalClaimBuilder.cpp
  src/PlantedTruthScorer.cpp, CalibrationHarness.cpp, InterventionEngine.cpp
  src/CausalActionEstimator.cpp, MinimumInterventionSearch.cpp

sim-credibility/
  src/CredibilityEngine.cpp, AsyncValidationRuntime.cpp

sim-agents/
  src/AgentFramework.cpp, AgentRuntime.cpp, MaritimeAgentBindings.cpp, Agents.cpp

sim-graph/
  src/TemporalCausalGraph.cpp, RelationshipGraph.cpp

sim-events/
  src/EventLedger.cpp

sim-tools/
  src/ScenarioRunner.cpp, SimFrameExporter.cpp

models/
  sensor-confidence-v0.yaml, commander-policy-v0.yaml, ...

scenarios/uas-maritime-cyber/
  scenario.yaml, comms-only.yaml

tests/unit/main.cpp
CMakeLists.txt
frontend/                    (React dashboard)
```

---

## 14. Glossary

| Term | Definition |
|------|------------|
| COA | Course of Action — a proposed intervention with authority and lifecycle |
| SCM | Structural Causal Model — explicit structural equations with exogenous noise |
| ATE | Average Treatment Effect — expected difference under do(treatment) vs control |
| SHD | Structural Hamming Distance — edge edits to transform estimated DAG to true DAG |
| ECE | Expected Calibration Error — weighted average of \|accuracy − confidence\| |
| E-value | Minimum confounding strength needed to explain away an observed effect |
| Planted truth | Ground-truth causal edges declared in scenario YAML for VV&A |
| Falsification | Executable counterfactual branch that can overturn a causal claim |
| Slow loop | Async validation pass after online agent decisions |
| Credibility contract | YAML artifact declaring model validity envelope and failure modes |

---

## 15. Claims appendix — what we claim / what we do not claim

Use this table verbatim in DARPA briefings and reviewer responses.

### We claim (supported by current evidence)

| Claim | Evidence |
|-------|----------|
| Deterministic replay is stable and auditable | Replay hash `5825267991280241626` at seed 42; 49 acceptance tests pass |
| Counterfactual interventions behave consistently with the declared SCM | `counterfactualImprovesMissionScore`, `interventionTimingIsCausal` tests; isolate sensor recovers detection T+1440 vs baseline T+1980 |
| Falsification branches overturn false causes | Logistics removal does not recover mission; credibility test `credibilityAssessmentsRejectFalseCause` |
| Back-door identification derives claim statuses from the declared DAG | `identificationDerivesClaimStatuses` — not hardcoded constants |
| Monte-Carlo estimation is reproducible per seed | `monteCarloEnsembleIsReproducible`; τ ≈ 0.19 for sensor-restore chain |
| Probability calibration is good in the canonical harness | Brier 0.0232, ECE 0.0134 (60 seeds × 4 regimes) |
| The system is designed to refuse unsupported COAs | `selectBestSupported` holds when no supported action clears gain threshold |
| Async slow loop provides post-decision audit | `AsyncValidationRuntime` replays and scores against planted truth |

### We do not claim (would be overclaiming today)

| Do not claim | Why |
|--------------|-----|
| "DARLA discovers causal structure" | Identifier consumes `planted_causal_truth` from YAML |
| "Perfect graph recovery validates causal discovery" | Recovery is circular: planted → identify → claim → score |
| "90% CI coverage is proven at 0.90" | n=30 gives Wilson CI [0.74, 0.97]; underpowered |
| "Operational runs carry full UQ" | Default path is noise-free; `scm_noise_enabled = false` |
| "Weak identification is empirically demonstrated" | Latent U is declared, not drawn in baseline SCM |
| "Dashboard metrics equal harness metrics" | CI coverage 0.75 (export) vs 0.90 (harness) on same scenario |
| "Ready for real ISR decision support" | Single micro-world; scripted adversary; no blind evaluation |
| "sign_accuracy = 1.0 proves effect sign recovery" | Hardcoded in `PlantedTruthScorer::score()` when edges match |

### Safe one-sentence pitch

> DARLA is not yet evidence that operational causal discovery works; it **is** evidence that a simulation can be engineered to produce auditable causal claims, falsify them, calibrate uncertainty, and downgrade unsupported recommendations — in a controlled maritime cyber slice.

### Safe metrics slide (canonical only)

```
sim-calibrate --seeds 60 --ci-experiments 30
  Brier: 0.0232 | ECE: 0.0134 | τ: 0.1897
  Planted-DAG F1: 1.0 (implementation fidelity, not discovery)
  CI coverage: 0.90 (n=30; report Wilson CI [0.74, 0.97])
```

---

*Generated for external review of the DARLA causal-agentic LVC prototype. Metrics verified 2026-06-28 against build-make targets `darla_tests`, `sim-verify`, `sim-calibrate`, and `sim-export`.*
