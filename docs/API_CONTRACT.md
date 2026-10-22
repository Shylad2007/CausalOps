# CausalOps — API Contract

All endpoints follow standard REST conventions. Error responses return JSON with `{ "detail": "message", "error_code": "..." }`.

---

## 1. System & Health

### `GET /api/health`
**Response:**
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "ai_status": "ready" | "fallback_only"
}
```

---

## 2. Scenarios

### `GET /api/scenarios`
Returns the list of available incident scenarios.
**Response:**
```json
[
  {
    "id": "scenario-apt-solar-infiltrate",
    "title": "Operation GhostPulse: Lateral Movement via Stolen Session Token",
    "description": "Sophisticated compromise starting from an engineer's workstation leading to database exfiltration.",
    "event_count": 18,
    "entity_count": 8,
    "severity": "critical"
  }
]
```

### `GET /api/scenarios/{scenario_id}`
Returns the complete scenario data (entities, timeline events, metadata).
**Response:**
```json
{
  "id": "scenario-apt-solar-infiltrate",
  "title": "Operation GhostPulse",
  "description": "...",
  "entities": [ ... ],
  "events": [ ... ],
  "metadata": { ... }
}
```

---

## 3. Deterministic Causal Graph

### `GET /api/scenarios/{scenario_id}/graph`
Computes or retrieves the deterministic causal event graph for the scenario.
**Response:**
```json
{
  "scenario_id": "scenario-apt-solar-infiltrate",
  "nodes": [
    {
      "id": "EVT-1001",
      "timestamp": "2026-10-18T08:14:02Z",
      "event_type": "auth_login",
      "severity": "medium",
      "entity_id": "workstation-eng-42",
      "summary": "User mchen logged into workstation"
    }
  ],
  "edges": [
    {
      "id": "rel-001",
      "source": "EVT-1001",
      "target": "EVT-1002",
      "relationship_type": "process_parent_child",
      "provenance": "deterministic_rule",
      "rule_name": "RuleProcessLineage",
      "explanation": "Process powershell.exe (PID 4412) was spawned by explorer.exe (PID 1024) under session 3.",
      "confidence": 1.0
    }
  ],
  "metrics": {
    "node_count": 18,
    "edge_count": 22,
    "root_cause_candidates": ["EVT-1001"],
    "critical_paths": [["EVT-1001", "EVT-1002", "EVT-1005", "EVT-1012"]]
  }
}
```

---

## 4. Competing Hypotheses & AI Investigation

### `GET /api/scenarios/{scenario_id}/hypotheses`
Fetches current hypotheses for the scenario (Gemma 4 generated or deterministic fallback).
**Response:**
```json
{
  "scenario_id": "scenario-apt-solar-infiltrate",
  "hypotheses": [
    {
      "id": "hyp-001",
      "title": "Compromised Developer Credentials & Token Theft",
      "description": "Adversary gained initial access via phishing credentials, spawned an encoded PowerShell script to dump token secrets, then pivoted to DB Server.",
      "supporting_event_ids": ["EVT-1001", "EVT-1002", "EVT-1005", "EVT-1009"],
      "contradictory_event_ids": ["EVT-1004"],
      "assumptions": ["MFA prompt was pushed via fatigue attack"],
      "unresolved_questions": ["Did the attacker obtain the session key from memory or disk cache?"],
      "investigation_status": "supported",
      "confidence_assessment": "High support based on parent-child lineage and direct token reuse across disparate IPs.",
      "recommended_steps": ["Inspect LSASS memory dump artifacts on workstation-eng-42"]
    }
  ]
}
```

### `POST /api/scenarios/{scenario_id}/hypotheses/challenge`
Submits an investigator challenge or query regarding an explanation.
**Request:**
```json
{
  "hypothesis_id": "hyp-001",
  "investigator_challenge": "Could EVT-1002 simply be a scheduled backup script run by DevOps?"
}
```
**Response:**
```json
{
  "reassessment": "While EVT-1002 executed a PowerShell command, the command line contained an obfuscated base64 payload `-enc SQBFAFgA...` which contradicts the standardized unencoded DevOps automation schedule. Furthermore, the parent PID 1024 corresponds to an interactive user logon rather than Task Scheduler (PID 880).",
  "status_update": "supported",
  "evidence_cited": ["EVT-1002", "EVT-1001"]
}
```

---

## 5. Counterfactual Investigation Lab

### `POST /api/scenarios/{scenario_id}/counterfactual/run`
Applies an isolated counterfactual intervention (event removal or field mutation) on a cloned scenario copy, recomputes the deterministic causal graph, calculates symmetric edge diffs, and evaluates hypothesis impacts with Gemma 4.

**Request:**
```json
{
  "mutation": {
    "mutation_type": "REMOVE_EVENT",
    "target_event_id": "EVT-1005",
    "field_path": null,
    "new_value": null
  },
  "include_ai_reassessment": true
}
```

**Response:**
```json
{
  "experiment_id": "exp-a1b2c3d4",
  "scenario_id": "scenario-apt-solar-infiltrate",
  "mutation": {
    "mutation_type": "REMOVE_EVENT",
    "target_event_id": "EVT-1005",
    "field_path": null,
    "new_value": null
  },
  "baseline_event_count": 10,
  "modified_event_count": 9,
  "baseline_edge_count": 9,
  "modified_edge_count": 8,
  "baseline_edges": [...],
  "modified_edges": [...],
  "edges_removed": [
    {
      "source_event_id": "EVT-1005",
      "target_event_id": "EVT-1006",
      "relationship_type": "process_parent_child",
      "rule_name": "RuleProcessLineage",
      "explanation": "Process on host 'workstation-eng-42' (PID 5120) was spawned by parent process (PPID 4412)...",
      "confidence": 1.0
    }
  ],
  "edges_added": [],
  "broken_causal_chains": [
    {
      "removed_edge": { "source": "EVT-1005", "target": "EVT-1006" },
      "affected_upstream_paths": [["EVT-1001", "EVT-1002", "EVT-1005", "EVT-1006"]],
      "downstream_events_disconnected": ["EVT-1006", "EVT-1007", "EVT-1008"],
      "explanation": "Removing the edge EVT-1005 -> EVT-1006 severs causal continuity..."
    }
  ],
  "hypothesis_impact": {
    "reassessment": "Eliminating EVT-1005 dismantles the attack progression completely...",
    "affected_hypotheses": [
      {
        "hypothesis_id": "hyp-001",
        "status": "refuted",
        "impact_summary": "Causal dependency severed: Token extraction cannot occur without this prerequisite stage."
      }
    ],
    "interpretation_type": "ai_generated_interpretation",
    "source": "gemma-4-26b-a4b-it",
    "unsupported_citations": []
  }
}
```


---

## 6. Evidence Audit & Scorecard

### `GET /api/scenarios/{scenario_id}/scorecard`
Executes a deterministic audit evaluating the active scenario's hypotheses against empirical graph rules, calibration criteria, and isolated benchmark ground truth.

**Response:**
```json
{
  "scenario_id": "scenario-apt-solar-infiltrate",
  "audit_status": "PASSED_WITH_DISTINCTION",
  "metrics": {
    "citation_validity_ratio": 1.0,
    "evidence_support_ratio": 0.95,
    "unsupported_claim_count": 0,
    "critical_milestone_coverage": 0.85,
    "contradiction_awareness_score": 1.0,
    "uncertainty_calibration_score": 0.9,
    "counterfactual_consistency_score": 1.0,
    "ground_truth_alignment_score": 0.88,
    "reproducibility_score": 1.0,
    "overall_audit_score": 92.4
  },
  "metric_provenance": {
    "citation_validity_ratio": "deterministic",
    "evidence_support_ratio": "deterministic",
    "unsupported_claim_count": "rule_based",
    "critical_milestone_coverage": "deterministic",
    "contradiction_awareness_score": "rule_based",
    "uncertainty_calibration_score": "rule_based",
    "counterfactual_consistency_score": "deterministic",
    "ground_truth_alignment_score": "ground_truth_benchmark",
    "reproducibility_score": "deterministic",
    "overall_audit_score": "rule_based"
  },
  "findings": [
    {
      "id": "find-cit-002",
      "category": "Citation Validity",
      "severity": "pass",
      "message": "All cited event references strictly resolve to existing scenario telemetry events.",
      "actionable_guidance": "No action required.",
      "metric_type": "deterministic",
      "cited_references": []
    }
  ],
  "hypotheses_evaluated_count": 2,
  "counterfactuals_evaluated_count": 0,
  "critical_failures_count": 0,
  "warnings_count": 0,
  "summary": "Audit status: PASSED_WITH_DISTINCTION. Overall fidelity score: 92.4/100..."
}
```

### `POST /api/scenarios/{scenario_id}/scorecard/evaluate`
Evaluates a custom or stateful collection of hypotheses and counterfactual experiment outputs against the scenario.

**Request:**
```json
{
  "hypotheses": [ ... ],
  "counterfactuals": [ ... ]
}
```
**Response:** Same `InvestigationScorecard` schema as above.

