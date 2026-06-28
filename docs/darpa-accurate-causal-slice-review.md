# DARPA-Accurate Causal Slice — Technical Review Document

**Project:** DARLA (Deterministic Agentic Runtime for Live Analysis)  
**Scope:** Vertical slice `cyber → sensor_confidence → detection_time → mission_success` with confounder `logistics.delay`  
**Scenario:** `scenarios/uas-maritime-cyber/scenario.yaml` (`uas-maritime-cyber-v001`)  
**Document purpose:** External technical review (e.g., ChatGPT) of whether the implementation satisfies the “DARPA accurate” plan: SCM + identification + Monte-Carlo estimation with calibrated uncertainty + validation metrics against planted truth.

---

## 1. Executive summary

The causal slice was converted from **declared constants** (hardcoded detection ticks, mission scores, claim effect sizes/confidences) into a **four-stage pipeline**:

1. **Structural Causal Model (SCM)** — explicit structural equations with exogenous noise, parameters θ in YAML.
2. **Identification** — DAG from planted truth; d-separation and back-door criterion derive `ClaimStatus`.
3. **Estimation** — Monte-Carlo average treatment effect (ATE) over seeded `do()` branches; bootstrap CI; `P(τ > 0)`; E-value sensitivity.
4. **Calibration / VV&A** — multi-seed harness: Brier, log-loss, ECE, reliability bins, CI coverage, graph recovery (precision/recall/F1/SHD), effect error.

**Backward compatibility:** Deterministic baseline simulation (noise-free SCM means) reproduces the legacy ladder exactly, so replay hashes and existing integration tests remain stable.

**Representative verification (uas-maritime-cyber, seed 42):**

| Metric | Value |
|--------|-------|
| Replay hash | `5825267991280241626` (stable across runs) |
| Baseline detection time | T+1980 |
| Planted-DAG precision / recall / F1 | 1.0 / 1.0 / 1.0 |
| Structural Hamming distance (SHD) | 0 |
| Calibration Brier (60 seeds/regime) | ~0.023 |
| Expected calibration error (ECE) | ~0.013 |
| 90% CI coverage (30 experiments) | ~0.90 |
| SCM true chain effect τ (sensor restore → mission) | ~0.19 |

---

## 2. Problem statement (before)

Prior to this work, causal quantities were **not estimated or identified** — they were **asserted**:

| Location | Hardcoded behavior |
|----------|------------------|
| `MicroWorldAdjudicator.cpp` | Detection ticks: `1320 / 1440 / 1700 / 1980 / 1900 / 1400`; mission scores: `0.42 / 0.61 / 0.68 / 0.67` |
| `CausalClaimBuilder.cpp` | `effect_size = 0.45`, `confidence = 0.81`, `status = DirectlyAdjudicated`, etc. |
| `InterventionEngine.cpp` | `estimated_effect` = single deterministic score difference; no distribution or identification |
| `PlantedTruthScorer` | Recall only (`recovery_score`) |
| `CredibilityContract` | `calibration_error`, `validation_score`, `uncertainty_score` fields existed but were unused or static |

The simulation kernel already had `SimConfig.seed` and `std::mt19937_64 rng_` in `SimulationKernel`, but the causal chain did not use stochastic exogenous noise.

---

## 3. Target causal model

### 3.1 Variables

| Symbol | Variable | Role |
|--------|----------|------|
| X | `red_cyber_actor.degrade_sensor_feed` | Treatment (cyber degrade) |
| S | `blue_uas_1.sensor.confidence` | Mediator |
| D | `detection_time` | Mediator |
| M | `mission_success_score` | Outcome |
| L | `logistics.delay` | Correlated non-causal confounder (red herring) |
| U | Shared tempo / commander risk (latent) | Unobserved confounder on D–M path |

### 3.2 Structural DAG (planted truth)

From `scenario.yaml` `planted_causal_truth`:

```
red_cyber_actor.degrade_sensor_feed
  → blue_uas_1.sensor_confidence_loss
  → delayed_target_detection
  → mission_failure_probability
```

Canonical node IDs used internally by identification/scoring normalize aliases (`detection_time`, `mission_success_score`, etc.) to these planted tokens.

### 3.3 Structural equations (implemented)

The implementation uses a **discrete-regime SCM** rather than a single continuous parametric form for D:

- **Sensor:** `β_cyber` from θ; noise `U_S ~ Normal(0, σ_S)` when stochastic mode is enabled.
- **Detection:** Structural **mean** is a function of discrete inputs `(degraded, isolated, autonomous, comms_blocking)` mapping to θ ladder values; plus `U_D ~ Normal(0, σ_D)` in stochastic mode.
- **Mission:** Structural mean from `(success, autonomous, isolated, preauthorized, high_confidence)` mapping to θ scores; plus `U_M` in stochastic mode.
- **Closed-form probability:** `P(D ≤ cutoff)` via Gaussian CDF on detection noise for calibration of mission-success probabilities.

**Design choice:** Noise-free means equal the legacy ladder so deterministic replay is unchanged. Stochastic noise is used for Monte-Carlo estimation and calibration, not for the default baseline run.

### 3.4 Plan vs implementation note (SCM location)

The plan specified `sim-causal/StructuralCausalModel.{h,cpp}`. The adjudicator (`sim-adjudication`) **cannot link** `sim-causal` due to the CMake dependency graph (`sim_core` → `sim_adjudication`; `sim_causal` → `sim_core`). SCM lives in **`sim-core`** (`StructuralCausalModel.{h,cpp}`), which both adjudicator and causal modules include.

---

## 4. Architecture

```
scenario.yaml (planted_truth + scm: θ)
        │
        ▼
ScenarioLoader ──► WorldState.scm, planted_truth, scm_noise_seed
        │
        ▼
SimulationKernel (deterministic baseline: scm_noise_enabled = false)
        │
        ▼
MicroWorldAdjudicator ──► StructuralCausalModel::detectionTickMean / missionScoreMean
        │
        ▼
EventLedger + MissionMetrics
        │
        ├─► CausalIdentifier (DAG + back-door) ──► ClaimStatus
        │
        ├─► CausalEffectEstimator (Monte-Carlo do() + bootstrap) ──► τ, CI, P(τ>0), E-value
        │
        ▼
CausalClaimBuilder ──► CausalClaim (effect_size, confidence, status, sensitivity, confounders)
        │
        ├─► PlantedTruthScorer ──► precision, recall, F1, SHD, sign accuracy, effect error, CI coverage
        │
        ├─► CalibrationHarness ──► Brier, log-loss, ECE, reliability, CI coverage
        │
        └─► CredibilityEngine / sim-export dashboard JSON
```

---

## 5. Module reference

### 5.1 Structural Causal Model

| File | Responsibility |
|------|----------------|
| `sim-core/include/StructuralCausalModel.h` | `ScmParameters`, `DetectionInputs`, `MissionInputs`, `StructuralCausalModel` |
| `sim-core/src/StructuralCausalModel.cpp` | Means, stochastic draws, `scmGaussian(seed, stream)`, `normalCdf`, `probabilityDetectBeforeCutoff` |
| `sim-core/include/WorldState.h` | `Scenario.scm`, `WorldState.scm`, `scm_noise_enabled`, `scm_noise_seed`, `planted_truth` |
| `sim-core/src/ScenarioLoader.cpp` | Parses `scm:` block from YAML |
| `sim-core/src/SimulationKernel.cpp` | Copies `scm`, `planted_truth`, `scm_noise_seed` from scenario on load |

**Stochastic mode:** `world.scm_noise_enabled = true` and `world.scm_noise_seed` set per branch replicate. Used by `CausalEffectEstimator` and `CalibrationHarness`, not default kernel steps.

### 5.2 Adjudicator integration

| File | Change |
|------|--------|
| `sim-adjudication/src/MicroWorldAdjudicator.cpp` | `maybeRecordDetection` / `maybeRecordCoaAndMission` call SCM instead of literal ticks/scores |

### 5.3 Identification (do-calculus)

| File | Responsibility |
|------|----------------|
| `sim-causal/include/sim-causal/Identification.h` | `CausalIdentifier`, `IdentificationResult` |
| `sim-causal/src/Identification.cpp` | DAG from planted edges; path enumeration; d-separation; back-door adjustment-set search; `ClaimStatus` derivation |

**Expected identification results (with latent D–M confounder declared):**

| Estimand | Expected `ClaimStatus` | Rationale |
|----------|------------------------|-----------|
| cyber → sensor | `DirectlyAdjudicated` | Direct manipulation + observed edge |
| sensor → detection | `Identifiable` | Directed path; empty admissible back-door set |
| detection → mission | `WeaklyIdentifiable` | Latent opens back-door; partial identification |
| logistics → mission | `Confounded` | No directed path in planted DAG |

### 5.4 Effect estimation

| File | Responsibility |
|------|----------------|
| `sim-causal/include/sim-causal/CausalEffectEstimator.h` | `CausalEffectEstimate`, `EffectEstimatorConfig`, `CausalEffectEstimator` |
| `sim-causal/src/CausalEffectEstimator.cpp` | Paired Monte-Carlo branches; bootstrap CI; `P(τ>0)`; Chinn/E-value sensitivity |

**Monte-Carlo protocol:**

- Control and treated branches use **independent** noise sub-seeds (`2n`, `2n+1`) to avoid common-random-number cancellation (which would collapse CI width).
- Bootstrap over replicate mean differences for CI and calibrated `P(τ>0)`.
- Closed-form `estimateStructuralContrast` for analytic SCM contrasts when no snapshot is passed to claim builder.

**Note:** Estimator runs `SimulationKernel` branches directly (not `InterventionEngine::run`) to avoid recursive claim building at end of counterfactual runs.

### 5.5 Claim builder

| File | Responsibility |
|------|----------------|
| `sim-causal/include/sim-causal/CausalClaimBuilder.h` | Optional `Snapshot*` + `horizon_ticks` for Monte-Carlo claims |
| `sim-causal/src/CausalClaimBuilder.cpp` | Populates all claim fields from identifier + estimator; preserves legacy **labels** for downstream falsification/credibility |

**Preserved claim labels (critical for tests and `CredibilityEngine`):**

- `sensor_confidence_loss -> delayed_detection`
- `delayed_detection -> mission_failure`
- `logistics_delay -> mission_failure rejected`

### 5.6 Validation metrics

| File | Responsibility |
|------|----------------|
| `sim-causal/include/sim-causal/PlantedTruthScorer.h` | Extended `PlantedTruthScore`, `EffectAccuracySample` |
| `sim-causal/src/PlantedTruthScorer.cpp` | Precision, recall, F1, SHD, sign accuracy; `scoreEffectAccuracy` for MAE and CI coverage |

**Scorer rule:** Claims with `Confounded` or `Falsified` status are **not** counted as recovered edges (avoids penalizing precision when correctly rejecting logistics).

### 5.7 Calibration harness

| File | Responsibility |
|------|----------------|
| `sim-causal/include/sim-causal/CalibrationHarness.h` | `CalibrationReport`, `CalibrationConfig`, `CalibrationHarness` |
| `sim-causal/src/CalibrationHarness.cpp` | Multi-regime outcome calibration; CI coverage experiments; full-run graph recovery |
| `sim-calibrate/main.cpp` | CLI tool; JSON export; populates credibility contract fields |

### 5.8 Surfacing / integration

| File | Change |
|------|--------|
| `sim-export/main.cpp` | `calibration` JSON block; extended `planted_truth`; overlays `calibration_error` / `validation_score` / `uncertainty_score` on assessments |
| `sim-verify/main.cpp` | Prints precision/recall/F1/SHD |
| `CMakeLists.txt` | `StructuralCausalModel.cpp`, `Identification.cpp`, `CausalEffectEstimator.cpp`, `CalibrationHarness.cpp`, `sim-calibrate` target |

---

## 6. YAML configuration (`scm:` block)

Excerpt from `scenarios/uas-maritime-cyber/scenario.yaml`:

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

Defaults in `ScmParameters` match these values; omitting `scm:` preserves legacy behavior.

---

## 7. Acceptance criteria traceability

| Criterion | Status | Evidence |
|-----------|--------|----------|
| No hardcoded effect sizes/confidences/detection-times in slice | **Met** | `CausalClaimBuilder` derives from estimator; adjudicator uses SCM |
| `L → M` reported `Confounded` via back-door test, not hardcoded confidence | **Met** | `CausalIdentifier::identify("logistics.delay", "mission_success_score")`; test `identificationDerivesClaimStatuses` |
| Calibration reports Brier, ECE, CI coverage, F1/SHD | **Met** | `sim-calibrate`, `sim-export` JSON, `CalibrationHarness` |
| Regression: coverage ~0.9, recovery F1 threshold | **Met** | `calibrationHarnessMeetsAccuracyThresholds` (threshold F1 ≥ 0.66, coverage ≥ 0.6; full harness ~0.90 coverage) |
| Deterministic per seed; MC ensemble reproducible | **Met** | `deterministicReplayHashMatches`, `monteCarloEnsembleIsReproducible` |

---

## 8. Test coverage (new + existing)

**New acceptance tests** in `tests/unit/main.cpp`:

1. `identificationDerivesClaimStatuses` — DAG-derived statuses; logistics confounded; derived effect ~0.19 for sensor chain.
2. `monteCarloEnsembleIsReproducible` — SCM noise determinism; MC ATE reproducibility; non-degenerate bootstrap interval.
3. `calibrationHarnessMeetsAccuracyThresholds` — Brier, ECE, F1, SHD, CI coverage, true effect range.

**Existing suite:** 50+ tests still pass (counterfactual timing, agent decisions, comms-only scenario, credibility falsification, minimum intervention search, etc.).

**Run:**

```bash
cmake --build build-make --target darla_tests
./build-make/darla_tests

cmake --build build-make --target sim-verify
./build-make/sim-verify scenarios/uas-maritime-cyber/scenario.yaml

cmake --build build-make --target sim-calibrate
./build-make/sim-calibrate scenarios/uas-maritime-cyber/scenario.yaml --seeds 60 --ci-experiments 30
```

---

## 9. Tools and outputs

### 9.1 `sim-verify`

Determinism check, ledger integrity, planted truth recovery, credibility assessments.

### 9.2 `sim-calibrate`

Multi-seed calibration report + optional JSON:

```bash
./build-make/sim-calibrate scenarios/uas-maritime-cyber/scenario.yaml --out calibration.json
```

### 9.3 `sim-export`

Dashboard JSON includes:

- `planted_truth`: `precision`, `recall`, `f1`, `structural_hamming_distance`, `sign_accuracy`
- `calibration`: `brier_score`, `log_loss`, `expected_calibration_error`, `ci_coverage`, `true_effect`, `calibration_error`, `validation_score`, `uncertainty_score`, `reliability` bins

Pass `--no-calibrate` to skip harness (faster export).

---

## 10. Known limitations and review points

Questions for external reviewer:

1. **SCM form:** Detection is a discrete ladder + Gaussian noise, not a continuous `γ_S · max(0, S* − S)` as sketched in the plan. Is this sufficient for “structural” rigor given backward-compat requirements?

2. **Latent confounder:** Declared as a pair `(detection_time, mission_success_score)` for identification; `latent_confounder_strength` affects sensitivity scoring but does not perturb deterministic baseline. Is partial identification handling adequate?

3. **Identification algorithm:** Exhaustive subset search over observed nodes for minimal back-door sets; polynomial in |nodes|. Acceptable for this 3-edge slice?

4. **Monte-Carlo vs closed-form:** `CausalClaimBuilder` uses closed-form SCM when no snapshot is provided (most call sites). Monte-Carlo available when snapshot + horizon passed. Is mixed-mode estimation acceptable?

5. **CI coverage variance:** Coverage depends on `ci_experiments` and `ci_replicates`; export uses smaller settings (12×16) than full calibration runs. Dashboard may show ~0.75 coverage while dedicated harness reaches ~0.90.

6. **InterventionEngine::estimated_effect:** Still a deterministic score difference for counterfactual results object; full UQ lives on `CausalClaim` fields. Should counterfactual API be extended?

7. **Comms-only scenario:** No `planted_causal_truth` in `comms-only.yaml`; identification/recovery metrics are scenario-specific.

8. **E-value mapping:** Uses Chinn (2000) standardized-effect → risk ratio → VanderWeele E-value. Appropriate for continuous mission score outcomes?

---

## 11. File inventory (implementation)

```
sim-core/include/StructuralCausalModel.h
sim-core/src/StructuralCausalModel.cpp
sim-core/include/WorldState.h          (scm, planted_truth, noise flags)
sim-core/src/ScenarioLoader.cpp        (scm: parsing)
sim-core/src/SimulationKernel.cpp      (scm threading)

sim-adjudication/src/MicroWorldAdjudicator.cpp

sim-causal/include/sim-causal/Identification.h
sim-causal/src/Identification.cpp
sim-causal/include/sim-causal/CausalEffectEstimator.h
sim-causal/src/CausalEffectEstimator.cpp
sim-causal/include/sim-causal/CalibrationHarness.h
sim-causal/src/CalibrationHarness.cpp
sim-causal/include/sim-causal/CausalClaimBuilder.h
sim-causal/src/CausalClaimBuilder.cpp
sim-causal/include/sim-causal/PlantedTruthScorer.h
sim-causal/src/PlantedTruthScorer.cpp

sim-calibrate/main.cpp
sim-export/main.cpp                    (calibration surfacing)
sim-verify/main.cpp                    (extended recovery output)

scenarios/uas-maritime-cyber/scenario.yaml  (scm: block)
tests/unit/main.cpp                    (acceptance tests)
CMakeLists.txt
```

---

## 12. Suggested review prompts for ChatGPT

Copy-paste for review session:

1. **Mathematical rigor:** Does the pipeline constitute a defensible SCM + identification + estimation stack for the stated vertical slice? What gaps remain vs Pearl-style causal inference?

2. **Identification correctness:** Verify back-door criterion implementation against the planted DAG and latent D–M confounder. Is `WeaklyIdentifiable` vs `Confounded` assignment correct for logistics → mission?

3. **UQ calibration:** Are Brier/ECE computed on the right probabilistic object (`P(mission success)` from detection threshold model)? Is bootstrap CI methodology sound for paired branch differences?

4. **VV&A metrics:** Are precision/recall/F1/SHD definitions appropriate for this planted-DAG recovery task? Any double-counting or alias issues in edge canonicalization?

5. **Regression safety:** Is preserving legacy deterministic behavior via noise-free SCM means a valid engineering tradeoff, or does it undermine “DARPA accuracy” claims?

6. **Threats to validity:** List top 5 ways this system could report high credibility while being wrong in a real deployment.

---

*Generated for external review of the DARLA “DARPA-accurate causal slice” implementation. Aligns with plan “Make the Causal Slice DARPA Accurate” (vertical slice a: cyber → sensor → detection → mission).*
