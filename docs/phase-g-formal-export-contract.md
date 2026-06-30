# DARLA Phase G Formal Export Contract

The dashboard should eventually receive this top-level structure directly from `sim-export`, `sim-stream`, or the API server.

```json
{
  "reasoning_layer": {
    "mission_id": "uas-maritime-cyber-v001",
    "objective": "Detect and track red maritime target before cutoff",
    "belief_updates": [
      {
        "tick": 720,
        "source": "sensor_agent",
        "key": "sensor_degraded",
        "prior": 0.0,
        "posterior": 0.91,
        "rationale": "sensor confidence degraded after cyber event"
      }
    ],
    "causal_assumptions": [
      {
        "source": "red_cyber_effect",
        "target": "sensor_confidence",
        "relation": "degrades",
        "confidence": 0.86
      }
    ],
    "uncertainty_notes": []
  },
  "simulation_layer": {
    "active_backend": "counterfactual",
    "runs": [
      {
        "action_id": "isolate_compromised_sensor_feed",
        "baseline_outcome": "detection_after_cutoff",
        "intervention_outcome": "detection_before_cutoff",
        "effect_delta": 0.1897,
        "supports_action": true
      }
    ],
    "replay_hash": "5825267991280241626"
  },
  "decision_layer": {
    "candidate_actions": [
      {
        "id": "isolate_compromised_sensor_feed",
        "label": "Isolate compromised sensor feed",
        "expected_gain": 0.18,
        "risk": 0.02,
        "authority_required": true
      }
    ],
    "selected_coa": "isolate_compromised_sensor_feed",
    "confidence_score": 0.49,
    "confidence_band": "medium",
    "caveats": [
      "Selected action requires explicit authority."
    ]
  },
  "evidence_package": {
    "mission_id": "uas-maritime-cyber-v001",
    "tick": 720,
    "observations": [],
    "causal_assumptions": [],
    "candidate_actions": [],
    "counterfactual_results": [],
    "selected_coa": "isolate_compromised_sensor_feed",
    "confidence_score": 0.49,
    "confidence_band": "medium",
    "caveats": [],
    "replay_hash": "5825267991280241626"
  }
}
```

Formal path:

```text
Observation
→ Belief update
→ Causal assumption
→ Counterfactual simulation
→ COA ranking
→ Evidence package
→ Recommendation or hold
```
