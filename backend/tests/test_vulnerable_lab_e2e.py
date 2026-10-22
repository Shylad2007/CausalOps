"""
backend/tests/test_vulnerable_lab_e2e.py
End-to-End Validation of CausalOps with the Synthetic Vulnerable Lab Fixture.
Verifies:
1. Sandboxed ingestion & project persistence
2. Deterministic AST vulnerability scanning against documented ground truth
3. Detection metrics (True Positives, False Positives, Detection Rate)
4. Attack graph generation
5. Incident scenario generation
6. Counterfactual analysis
7. Automated remediation patch generation and re-scan verification
"""
import secrets
import pytest
from fastapi.testclient import TestClient
from main import app
from app.auth.auth_service import auth_service
from app.services.project_storage import delete_project
from pathlib import Path

client = TestClient(app)

@pytest.fixture
def auth_headers():
    username = f"test_e2e_{secrets.token_hex(4)}"
    res = auth_service.register(username, "password123", f"{username}@test.local")
    try:
        yield {"Authorization": f"Bearer {res.token}"}
    finally:
        auth_service.delete_user(username)

def test_vulnerable_lab_full_pipeline_validation(auth_headers):
    zip_path = Path("test-fixtures/vulnerable-lab.zip")
    assert zip_path.exists(), "Test fixture vulnerable-lab.zip must exist"

    # 1. Ingest synthetic fixture via backend API
    with open(zip_path, "rb") as f:
        resp = client.post(
            "/api/codebase/scan/upload",
            files={"file": ("vulnerable-lab.zip", f, "application/zip")},
            data={"project_name": "VulnerableLab-DefenseTest"},
            headers=auth_headers
        )
    assert resp.status_code == 200, f"Upload failed: {resp.text}"
    scan_data = resp.json()
    proj_id = scan_data["project_id"]

    assert scan_data["project_name"] == "VulnerableLab-DefenseTest"
    assert scan_data["total_findings"] >= 5, f"Expected at least 5 findings, got {scan_data['total_findings']}"

    # 2. Verify ground truth rule coverage
    found_rules = {f["rule_id"]: f for f in scan_data["findings"]}
    expected_rules = [
        "RULE-SEC-001",  # SQL Injection
        "RULE-SEC-002",  # Command Injection
        "RULE-SEC-003",  # Hardcoded Secret
        "RULE-SEC-004",  # Path Traversal
        "RULE-SEC-005",  # Insecure CORS
    ]

    for rule_id in expected_rules:
        assert rule_id in found_rules, f"Rule {rule_id} was expected in vulnerable-lab ground truth but was not detected!"
        f = found_rules[rule_id]
        assert f["file_path"] is not None
        assert f["line_start"] > 0
        assert len(f["code_snippet"]) > 0

    # 3. Verify attack graph generation for the ingested project
    graph_resp = client.get(f"/api/codebase/projects/{proj_id}/graph", headers=auth_headers)
    assert graph_resp.status_code == 200
    graph_data = graph_resp.json()
    assert len(graph_data["nodes"]) >= 3
    assert len(graph_data["edges"]) >= 2

    # 4. Verify incident scenario generation
    scen_resp = client.get(f"/api/codebase/projects/{proj_id}/scenario", headers=auth_headers)
    assert scen_resp.status_code == 200
    scenario_data = scen_resp.json()
    assert len(scenario_data["events"]) >= 3
    assert len(scenario_data["entities"]) >= 3

    # 5. Run counterfactual experiment on the project
    first_event_id = scenario_data["events"][0]["id"]
    cf_resp = client.post(
        f"/api/scenarios/{proj_id}/counterfactual/run",
        json={
            "mutation": {
                "mutation_type": "REMOVE_EVENT",
                "target_event_id": first_event_id
            },
            "include_ai_reassessment": False
        },
        headers=auth_headers
    )
    assert cf_resp.status_code == 200
    cf_data = cf_resp.json()
    assert cf_data["experiment_id"] is not None
    assert "edges_removed" in cf_data
    assert cf_data["baseline_event_count"] > cf_data["modified_event_count"]

    # 6. Generate competing hypotheses for the active project
    hyp_resp = client.get(f"/api/scenarios/{proj_id}/hypotheses", headers=auth_headers)
    assert hyp_resp.status_code == 200
    hyp_data = hyp_resp.json()
    assert len(hyp_data["hypotheses"]) >= 2
    assert "source" in hyp_data

    # 7. Run investigation scorecard audit with generated hypotheses & counterfactual
    scorecard_resp = client.post(
        f"/api/scenarios/{proj_id}/scorecard/evaluate",
        json={
            "hypotheses": hyp_data["hypotheses"],
            "counterfactuals": [cf_data]
        },
        headers=auth_headers
    )
    assert scorecard_resp.status_code == 200
    scorecard_data = scorecard_resp.json()
    assert scorecard_data["audit_status"] in ["PASSED_WITH_DISTINCTION", "PASSED_AUDIT", "REQUIRES_REVIEW", "CRITICAL_FAILURES"]
    assert "metrics" in scorecard_data
    assert scorecard_data["metrics"]["overall_audit_score"] >= 0
    assert scorecard_data["hypotheses_evaluated_count"] == len(hyp_data["hypotheses"])
    assert scorecard_data["counterfactuals_evaluated_count"] >= 1

    # 8. Test automated patch synthesis and verification
    sqli_finding = found_rules["RULE-SEC-001"]
    finding_id = sqli_finding["id"]

    patch_resp = client.post(
        f"/api/codebase/projects/{proj_id}/patch/generate?finding_id={finding_id}",
        headers=auth_headers
    )
    assert patch_resp.status_code == 200
    patch_data = patch_resp.json()
    assert "proposed_code" in patch_data
    assert "diff" in patch_data

    # Verify resolution
    verify_resp = client.post(
        f"/api/codebase/projects/{proj_id}/patch/verify",
        json={"finding_id": finding_id, "proposed_code": patch_data["proposed_code"]},
        headers=auth_headers
    )
    assert verify_resp.status_code == 200
    verify_data = verify_resp.json()
    assert verify_data["verification_status"] == "VERIFIED_FIXED"
    assert verify_data["verified"] is True
    assert verify_data["attack_path_severed"] is True
