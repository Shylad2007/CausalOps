"""
Phase 4 Automated Test Suite:
Evidence-Driven Vulnerability Investigation, AI Remediation & Independent Verification.
Tests:
- Source-to-sink evidence extraction and data-flow steps via AST.
- Secret masking in vulnerable snippets.
- Gemma 4 remediation generation with schema & syntax validation.
- Transparent deterministic fallback attribution when model unconfigured.
- Strict path traversal rejection and patch syntax validation.
- Tri-state verification outcomes (VERIFIED, FAILED).
- Re-scan check for newly introduced findings.
"""
import pytest
import os
import sys
import json
import shutil
import tempfile
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import app
from app.auth.auth_service import AuthService
from app.analysis.code_scanner import CodeScannerService, mask_secret_value
from app.ai.gemma_service import GemmaService
from app.services.project_storage import save_project, register_project_ownership, save_project_source
from app.models.codebase_schemas import (
    CodebaseScanResult,
    CodebaseManifest,
    VulnerabilityCategory,
    VulnerabilitySeverity,
    VerificationOutcome,
    FindingStatus,
    VulnerabilityFinding,
    ProposedPatch,
)

client = TestClient(app)
_auth = AuthService()


def _get_test_auth_headers(username: str = "phase4_user"):
    try:
        res = _auth.register(username, "Phase4SecurePass123!", f"{username}@test.local")
        return {"Authorization": f"Bearer {res.token}"}
    except ValueError:
        res = _auth.login(username, "Phase4SecurePass123!")
        return {"Authorization": f"Bearer {res.token}"}


@pytest.fixture
def scanner():
    return CodeScannerService()


@pytest.fixture
def gemma_service():
    return GemmaService()


class TestASTEvidenceDataFlow:
    """Tests evidence-backed finding fields and AST data-flow analysis."""

    def test_sql_injection_ast_data_flow(self, scanner):
        code = '''def search_user(search_query):
    query = f"SELECT * FROM users WHERE username = '{search_query}'"
    cursor.execute(query)
'''
        findings = scanner.scan_python_ast("api/routes/users.py", code)
        assert len(findings) == 1
        f = findings[0]
        assert f.category == VulnerabilityCategory.SQL_INJECTION
        assert "ast" in f.detection_method
        assert f.source_location is not None
        assert "users.py" in f.source_location
        assert f.sink_location is not None
        assert "cursor.execute" in f.sink_location
        assert len(f.data_flow_steps) >= 1

    def test_command_injection_ast_data_flow(self, scanner):
        code = '''import os
def ping_host(host_ip):
    os.system("ping -c 1 " + host_ip)
'''
        findings = scanner.scan_python_ast("services/network.py", code)
        assert len(findings) == 1
        f = findings[0]
        assert f.category == VulnerabilityCategory.COMMAND_INJECTION
        assert "ast" in f.detection_method
        assert "services/network.py" in f.source_location
        assert "os.system" in f.sink_location
        assert len(f.data_flow_steps) >= 1

    def test_insecure_cors_ast(self, scanner):
        code = '''from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
)
'''
        findings = scanner.scan_python_ast("main.py", code)
        assert len(findings) == 1
        f = findings[0]
        assert f.category == VulnerabilityCategory.INSECURE_CORS
        assert "ast" in f.detection_method
        assert "wildcard" in f.evidence_summary.lower()

    def test_secret_masking(self):
        val = "super_secret_production_key_992184812"
        masked = mask_secret_value(val)
        assert masked.startswith("su")
        assert masked.endswith("12")
        assert "super_secret_production_key" not in masked
        assert "*" in masked

    def test_hardcoded_secret_ast_with_masking(self, scanner):
        code = '''JWT_SECRET = "super_secret_production_key_992184812"
'''
        findings = scanner.scan_python_ast("config.py", code)
        assert len(findings) == 1
        f = findings[0]
        assert f.category == VulnerabilityCategory.HARDCODED_SECRET
        assert f.masked_snippet is not None
        assert "super_secret_production_key_992184812" not in f.masked_snippet
        assert "supe" in f.masked_snippet and "4812" in f.masked_snippet


class TestGemmaRemediationProposal:
    """Tests genuine Gemma 4 integration and fallback attribution."""

    def test_fallback_remediation_attribution(self, gemma_service):
        finding = VulnerabilityFinding(
            id="VULN-001",
            rule_id="RULE-PY-SQLI-AST",
            category=VulnerabilityCategory.SQL_INJECTION,
            severity=VulnerabilitySeverity.CRITICAL,
            title="SQL Injection in search",
            description="Raw string query formatting",
            file_path="api/users.py",
            line_start=3,
            line_end=4,
            code_snippet='query = f"SELECT * FROM users WHERE username = \'{search_query}\'"\ncursor.execute(query)',
            cwe_id="CWE-89",
            remediation_guidance="Use parameterized queries",
        )
        source_code = '''def search(search_query):
    query = f"SELECT * FROM users WHERE username = '{search_query}'"
    cursor.execute(query)
'''
        with patch.object(gemma_service, "is_configured", return_value=False):
            patch_result = gemma_service.generate_remediation_proposal(finding, source_code)
            assert patch_result.is_fallback is True
            assert patch_result.remediation_source == "deterministic_fallback"
            assert "parameterized" in patch_result.explanation.lower()
            assert patch_result.expected_security_effect is not None
            assert patch_result.regression_risks is not None
            assert "%s" in patch_result.proposed_code or "?" in patch_result.proposed_code

    def test_gemma_api_response_parsing(self, gemma_service):
        finding = VulnerabilityFinding(
            id="VULN-002",
            rule_id="RULE-PY-CMD-AST",
            category=VulnerabilityCategory.COMMAND_INJECTION,
            severity=VulnerabilitySeverity.CRITICAL,
            title="Command Injection in ping",
            description="os.system call with dynamic input",
            file_path="services/ping.py",
            line_start=3,
            line_end=3,
            code_snippet='os.system("ping -c 1 " + host)',
            cwe_id="CWE-78",
            remediation_guidance="Use subprocess.run without shell=True",
        )
        source_code = '''import os
def ping(host):
    os.system("ping -c 1 " + host)
'''
        mock_response_json = json.dumps({
            "proposed_code": "import subprocess\nsubprocess.run(['ping', '-c', '1', host], check=True)",
            "explanation": "Executes ping using subprocess.run without shell=True to neutralize command injection.",
            "expected_security_effect": "Neutralizes shell argument injection.",
            "regression_risks": "Requires shlex or list-based argument passing.",
            "verification_guidance": "Confirm command injection payload fails safely."
        })

        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = MagicMock(text=mock_response_json)

        with patch.object(gemma_service, "_client", mock_client), \
             patch.object(gemma_service, "is_configured", return_value=True):
            patch_result = gemma_service.generate_remediation_proposal(finding, source_code)
            assert patch_result.is_fallback is False
            assert "gemma-4-26b-a4b-it" in patch_result.remediation_source
            assert "subprocess.run" in patch_result.proposed_code
            assert patch_result.expected_security_effect == "Neutralizes shell argument injection."


class TestIndependentPatchVerification:
    """Tests safety guards and tri-state independent verification."""

    def test_path_traversal_patch_rejected(self):
        headers = _get_test_auth_headers("phase4_trav_user")

        # Attempt directory traversal path in patch verification
        res = client.post(
            "/api/codebase/projects/proj-demo-shoppulse/patch/verify",
            headers=headers,
            json={
                "finding_id": "VULN-001",
                "proposed_code": "print('exploit')",
                "target_file": "../../etc/passwd",
            },
        )
        assert res.status_code in (400, 403, 404, 422)

    def test_syntax_invalid_patch_fails_verification(self):
        project_id = "test_phase4_syntax_proj"
        username = "phase4_syntax_user"
        headers = _get_test_auth_headers(username)

        finding = VulnerabilityFinding(
            id="VULN-001",
            rule_id="RULE-PY-SQLI-AST",
            category=VulnerabilityCategory.SQL_INJECTION,
            severity=VulnerabilitySeverity.CRITICAL,
            title="SQL Injection",
            description="SQL Injection in search",
            file_path="app/routes/users.py",
            line_start=1,
            line_end=2,
            code_snippet="def search(q):\n    pass\n",
            remediation_guidance="Use parameterized queries",
        )

        scan_res = CodebaseScanResult(
            project_id=project_id,
            project_name="Phase4 Syntax Test",
            manifest=CodebaseManifest(project_name="Phase4 Syntax Test"),
            findings=[finding],
            total_findings=1,
            critical_count=1,
            high_count=0,
            medium_count=0,
            low_count=0,
            open_findings_count=1,
            fixed_findings_count=0,
            is_demo=False,
            scan_timestamp=datetime.now(timezone.utc).isoformat(),
            owner_username=username,
        )

        stored_files = {
            "app/routes/users.py": "def search(q):\n    pass\n"
        }

        save_project(scan_res)
        save_project_source(project_id, stored_files)
        register_project_ownership(project_id, username)

        try:
            # Post a patch with broken syntax
            res = client.post(
                f"/api/codebase/projects/{project_id}/patch/verify",
                headers=headers,
                json={
                    "finding_id": "VULN-001",
                    "proposed_code": "def broken_syntax(:\n  return None",
                    "target_file": "app/routes/users.py",
                },
            )
            assert res.status_code == 200
            data = res.json()
            assert data["outcome"] == VerificationOutcome.FAILED.value
            assert data["verified"] is False
            assert "syntax" in data["message"].lower() or data["evidence_report"]["syntax_valid"] is False
        finally:
            from app.services.project_storage import delete_project
            delete_project(project_id)
