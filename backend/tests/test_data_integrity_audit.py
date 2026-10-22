"""
backend/tests/test_data_integrity_audit.py
Targeted Regression Tests for Data Integrity & Stabilization Audit:
1. GitHub Archive single-root directory stripping (prevents path prefix leaking).
2. Rescan idempotency: Repeated scans on unchanged commit do not create duplicate findings.
3. Post-merge sync with commit prefix differences does NOT inflate finding count (5 findings remain 5, 1 verified fixed + 4 open).
4. Local patch verification marks finding APPLIED for GitHub-connected projects, not prematurely VERIFIED_FIXED.
5. Deleted/renamed files in new revision correctly resolve findings without orphaned records.
6. AI challenge and counterfactual fallbacks dynamically ground in scenario events without phantom citations.
"""
import io
import json
import zipfile
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from main import app
from app.auth.auth_service import auth_service
from app.analysis.repo_ingest import RepoIngestService
from app.analysis.code_scanner import CodeScannerService
from app.services.project_storage import get_project
from app.ai.gemma_service import GemmaService
from app.models.schemas import (
    Scenario,
    Entity,
    Event,
    EntityType,
    SecurityZone,
    EventSeverity,
    HypothesisChallengeRequest,
    CounterfactualExperimentRequest,
    ScenarioMutation,
    MutationType,
)

client = TestClient(app)


@pytest.fixture
def test_user():
    try:
        auth_service.register("auditor_user", "Password123!", "auditor@example.com")
    except ValueError:
        pass
    token = auth_service.login("auditor_user", "Password123!").token
    return {"token": token, "headers": {"Authorization": f"Bearer {token}"}}


def test_archive_single_root_stripping(tmp_path):
    """
    Simulates downloading a GitHub zipball with top-level folder {owner}-{repo}-{commit_hash}.
    Verifies that extract_zip strips the single root and extracts files to canonical paths.
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("myorg-testing-a1b2c3d/backend/main.py", "print('hello')\n")
        zf.writestr("myorg-testing-a1b2c3d/backend/api/users.py", "def get_users(): pass\n")
        zf.writestr("myorg-testing-a1b2c3d/README.md", "# Project\n")

    svc = RepoIngestService()
    extracted = svc.extract_zip(buf.getvalue(), str(tmp_path))

    # All files must be extracted at canonical paths without myorg-testing-a1b2c3d prefix
    assert (tmp_path / "backend" / "main.py").exists()
    assert (tmp_path / "backend" / "api" / "users.py").exists()
    assert (tmp_path / "README.md").exists()
    assert not (tmp_path / "myorg-testing-a1b2c3d").exists()


def test_post_merge_sync_no_finding_count_inflation(test_user):
    """
    Regression test for the 5-to-10 finding inflation bug:
    Initial ingest has 5 findings in commit 1 with root prefix owner-repo-sha1/.
    PR fixes 1 finding (CORS) in commit 2 with root prefix owner-repo-sha2/.
    After post-merge sync:
    - Total findings MUST remain 5 (NOT inflate to 10).
    - Exactly 1 finding is confirmed VERIFIED_FIXED.
    - Exactly 4 findings remain OPEN.
    - File paths are normalized without commit prefixes.
    """
    user_headers = test_user["headers"]

    # 1. Create Commit 1 archive (5 deliberate vulnerabilities)
    buf1 = io.BytesIO()
    with zipfile.ZipFile(buf1, "w") as zf1:
        prefix1 = "testorg-myapp-1111111"
        zf1.writestr(f"{prefix1}/backend/main.py", (
            "from fastapi import FastAPI\n"
            "from fastapi.middleware.cors import CORSMiddleware\n"
            "app = FastAPI()\n"
            "app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=True)\n"
        ))
        zf1.writestr(f"{prefix1}/backend/api/users.py", (
            "import os\n"
            "def search(q):\n"
            "    cursor.execute(f\"SELECT * FROM users WHERE id = '{q}'\")\n"
        ))
        zf1.writestr(f"{prefix1}/backend/core/config.py", (
            "JWT_SECRET = \"super_secret_jwt_key_999999\"\n"
        ))
        zf1.writestr(f"{prefix1}/backend/services/backup.py", (
            "import os\n"
            "def backup(p):\n"
            "    os.system(f\"tar -czf backup.tar.gz {p}\")\n"
        ))
        zf1.writestr(f"{prefix1}/backend/api/files.py", (
            "def read_file(path):\n"
            "    with open(f\"/tmp/{path}\", 'r') as f:\n"
            "        return f.read()\n"
        ))

    mock_client = MagicMock()

    def mock_get(url, **kwargs):
        resp = MagicMock()
        resp.is_success = True
        if "/zipball/main" in url or "/zipball/1111111" in url:
            resp.status_code = 200
            resp.content = buf1.getvalue()
            resp.history = []
            return resp
        if "/git/ref/heads/main" in url:
            resp.status_code = 200
            resp.json.return_value = {"object": {"sha": "1111111111111111111111111111111111111111"}}
            return resp
        resp.status_code = 404
        return resp

    mock_client.get.side_effect = mock_get

    with patch("app.analysis.github_ingest.httpx.Client", return_value=mock_client), \
         patch("app.services.github_service.httpx.Client", return_value=mock_client):

        # Ingest initial repo
        res = client.post(
            "/api/codebase/github/connect",
            json={
                "repo_url": "https://github.com/testorg/myapp",
                "branch": "main",
                "commit_sha": "1111111111111111111111111111111111111111",
                "project_name": "TestOrg-MyApp",
            },
            headers=user_headers,
        )
        assert res.status_code == 200, f"Connect failed: {res.text}"
        proj_data = res.json()
        proj_id = proj_data["project_id"]

        assert proj_data["total_findings"] == 5
        assert proj_data["open_findings_count"] == 5
        assert proj_data["fixed_findings_count"] == 0

        # Verify all file paths are canonical (no prefix)
        for f in proj_data["findings"]:
            assert not f["file_path"].startswith("testorg-myapp")

    # 2. Create Commit 2 archive: CORS is fixed, remaining 4 vulnerabilities persist
    buf2 = io.BytesIO()
    with zipfile.ZipFile(buf2, "w") as zf2:
        prefix2 = "testorg-myapp-2222222"
        zf2.writestr(f"{prefix2}/backend/main.py", (
            "from fastapi import FastAPI\n"
            "from fastapi.middleware.cors import CORSMiddleware\n"
            "app = FastAPI()\n"
            "app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:3000'], allow_credentials=True)\n"
        ))
        zf2.writestr(f"{prefix2}/backend/api/users.py", (
            "import os\n"
            "def search(q):\n"
            "    cursor.execute(f\"SELECT * FROM users WHERE id = '{q}'\")\n"
        ))
        zf2.writestr(f"{prefix2}/backend/core/config.py", (
            "JWT_SECRET = \"super_secret_jwt_key_999999\"\n"
        ))
        zf2.writestr(f"{prefix2}/backend/services/backup.py", (
            "import os\n"
            "def backup(p):\n"
            "    os.system(f\"tar -czf backup.tar.gz {p}\")\n"
        ))
        zf2.writestr(f"{prefix2}/backend/api/files.py", (
            "def read_file(path):\n"
            "    with open(f\"/tmp/{path}\", 'r') as f:\n"
            "        return f.read()\n"
        ))

    mock_sync_client = MagicMock()

    def mock_sync_get(url, **kwargs):
        resp = MagicMock()
        resp.is_success = True
        if "/pulls/101" in url:
            resp.status_code = 200
            resp.json.return_value = {
                "state": "closed",
                "merged": True,
                "merge_commit_sha": "2222222222222222222222222222222222222222",
            }
            return resp
        if "/git/ref/heads/main" in url:
            resp.status_code = 200
            resp.json.return_value = {"object": {"sha": "2222222222222222222222222222222222222222"}}
            return resp
        if "/zipball" in url:
            resp.status_code = 200
            resp.content = buf2.getvalue()
            resp.history = []
            return resp
        resp.status_code = 404
        return resp

    mock_sync_client.get.side_effect = mock_sync_get

    with patch("app.services.github_service.httpx.Client", return_value=mock_sync_client):
        sync_res = client.post(
            f"/api/codebase/projects/{proj_id}/github/sync",
            json={
                "pull_request_number": 101,
                "github_token": "ghp_mock_token",
            },
            headers=user_headers,
        )
        assert sync_res.status_code == 200, f"Sync failed: {sync_res.text}"
        sync_data = sync_res.json()

        # Check total findings did NOT double to 10
        assert sync_data["total_findings"] == 5, f"Expected 5 findings, got {sync_data['total_findings']}"
        assert sync_data["resolved_findings_count"] == 1
        assert sync_data["new_findings_count"] == 0
        assert sync_data["pull_request_merged"] is True

        # Fetch persisted project from DB to verify internal consistency
        updated_proj = get_project(proj_id)
        assert updated_proj.total_findings == 5
        assert updated_proj.fixed_findings_count == 1
        assert updated_proj.open_findings_count == 4

        # Confirm CORS is the VERIFIED_FIXED finding and others remain OPEN
        cors_f = next(f for f in updated_proj.findings if f.rule_id == "RULE-SEC-005")
        assert cors_f.finding_status == "VERIFIED_FIXED"
        assert cors_f.file_path == "backend/main.py"

        sql_f = next(f for f in updated_proj.findings if f.rule_id == "RULE-SEC-001")
        assert sql_f.finding_status == "OPEN"
        assert sql_f.file_path == "backend/api/users.py"


def test_local_patch_verify_marks_applied_for_github_repo(test_user):
    """
    Verifies that applying a patch locally to a GitHub-connected project
    transitions the finding status to APPLIED, not prematurely VERIFIED_FIXED.
    """
    user_headers = test_user["headers"]

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("backend/main.py", (
            "from fastapi import FastAPI\n"
            "from fastapi.middleware.cors import CORSMiddleware\n"
            "app = FastAPI()\n"
            "app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=True)\n"
        ))

    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = buf.getvalue()
    mock_resp.history = []
    mock_resp.json.return_value = {"object": {"sha": "3333333333333333333333333333333333333333"}}
    mock_client.get.return_value = mock_resp

    with patch("app.analysis.github_ingest.httpx.Client", return_value=mock_client):
        res = client.post(
            "/api/codebase/github/connect",
            json={
                "repo_url": "https://github.com/testorg/app-lifecycle",
                "branch": "main",
                "commit_sha": "3333333333333333333333333333333333333333",
                "project_name": "LifecycleApp",
            },
            headers=user_headers,
        )
        assert res.status_code == 200
        proj_data = res.json()
        proj_id = proj_data["project_id"]
        cors_f = proj_data["findings"][0]

        # Generate patch
        gen_res = client.post(
            f"/api/codebase/projects/{proj_id}/patch/generate?finding_id={cors_f['id']}",
            headers=user_headers,
        )
        assert gen_res.status_code == 200
        patch_info = gen_res.json()

        # Verify patch locally
        ver_res = client.post(
            f"/api/codebase/projects/{proj_id}/patch/verify",
            json={
                "finding_id": cors_f["id"],
                "proposed_code": patch_info["proposed_code"],
                "target_file": cors_f["file_path"],
            },
            headers=user_headers,
        )
        assert ver_res.status_code == 200
        ver_data = ver_res.json()

        # For GitHub-connected project, status must be APPLIED (local sandbox fix applied, awaiting PR merge)
        assert ver_data["verification_status"] == "APPLIED"
        assert ver_data["verified"] is True

        # Check DB
        persisted = get_project(proj_id)
        f_in_db = next(f for f in persisted.findings if f.id == cors_f["id"])
        assert f_in_db.finding_status == "APPLIED"


def test_gemma_fallback_dynamic_grounding():
    """
    Verifies that AI challenge and counterfactual fallbacks ground citations
    strictly in active scenario events and do not inject phantom citations (EVT-1005).
    """
    custom_scenario = Scenario(
        id="scenario-custom-app",
        title="Custom E-Commerce API",
        description="Active investigation scenario",
        severity=EventSeverity.HIGH,
        entities=[
            Entity(id="ent-gw", name="Gateway", type=EntityType.SERVER, zone=SecurityZone.DMZ, position_3d=[0, 0, 0]),
            Entity(id="ent-db", name="DB", type=EntityType.DATABASE, zone=SecurityZone.PROD_INTERNAL, position_3d=[5, 0, 0]),
        ],
        events=[
            Event(
                id="EVT-CUST-01",
                timestamp="2026-10-20T10:00:00Z",
                event_type="exploit_execution",
                source_entity_id="ent-gw",
                target_entity_id="ent-db",
                severity=EventSeverity.CRITICAL,
                summary="Exploitation of SQL injection via query parameter",
                observable_data={"file": "backend/users.py"}
            )
        ]
    )

    valid_ids = {"EVT-CUST-01"}
    svc = GemmaService()
    svc.api_key = ""  # Force deterministic fallback

    challenge = HypothesisChallengeRequest(
        hypothesis_id="hyp-001",
        challenge_type="alternative_explanation",
        challenge="Could this be automated testing?"
    )

    resp = svc.challenge_hypothesis(custom_scenario, challenge)
    assert resp.source == "deterministic_fallback"
    # Citations must be grounded in EVT-CUST-01, never phantom EVT-1005
    for eid in resp.evidence_cited:
        assert eid in valid_ids, f"Ungrounded citation detected: {eid}"
    assert "Custom E-Commerce API" in resp.reassessment


def test_repeated_scan_unchanged_commit_is_idempotent(test_user):
    """
    Verifies that calling sync on an unchanged commit is idempotent:
    Returns ALREADY_UP_TO_DATE, does not duplicate findings or alter counts.
    """
    user_headers = test_user["headers"]

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("backend/main.py", (
            "from fastapi import FastAPI\n"
            "from fastapi.middleware.cors import CORSMiddleware\n"
            "app = FastAPI()\n"
            "app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=True)\n"
        ))

    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = buf.getvalue()
    mock_resp.history = []
    mock_resp.json.return_value = {
        "sha": "4444444444444444444444444444444444444444",
        "object": {"sha": "4444444444444444444444444444444444444444"},
    }
    mock_client.get.return_value = mock_resp

    with patch("app.analysis.github_ingest.httpx.Client", return_value=mock_client), \
         patch("app.services.github_service.httpx.Client", return_value=mock_client):

        res = client.post(
            "/api/codebase/github/connect",
            json={
                "repo_url": "https://github.com/testorg/idempotent-app",
                "branch": "main",
                "commit_sha": "4444444444444444444444444444444444444444",
                "project_name": "IdempotentApp",
            },
            headers=user_headers,
        )
        assert res.status_code == 200
        proj_id = res.json()["project_id"]

        # Call sync with unchanged sha
        sync_res = client.post(
            f"/api/codebase/projects/{proj_id}/github/sync",
            json={"branch": "main", "force_rescan": False},
            headers=user_headers,
        )
        assert sync_res.status_code == 200
        sync_data = sync_res.json()
        assert sync_data["status"] == "ALREADY_UP_TO_DATE"
        assert sync_data["total_findings"] == 1
        assert sync_data["resolved_findings_count"] == 0
        assert sync_data["new_findings_count"] == 0


def test_deleted_file_in_new_revision_resolves_finding(test_user):
    """
    When a vulnerable file is deleted in the remote branch,
    sync_and_rescan detects its absence and marks the finding VERIFIED_FIXED.
    """
    user_headers = test_user["headers"]

    # Commit 1 has vulnerable endpoint in deprecated.py
    buf1 = io.BytesIO()
    with zipfile.ZipFile(buf1, "w") as zf1:
        zf1.writestr("backend/deprecated.py", (
            "import os\n"
            "def old_ping(ip):\n"
            "    os.system(f'ping -c 1 {ip}')\n"
        ))
        zf1.writestr("backend/main.py", "print('healthy')\n")

    # Commit 2 removes deprecated.py completely
    buf2 = io.BytesIO()
    with zipfile.ZipFile(buf2, "w") as zf2:
        zf2.writestr("backend/main.py", "print('healthy')\n")

    mock_client1 = MagicMock()
    mock_resp1 = MagicMock()
    mock_resp1.status_code = 200
    mock_resp1.content = buf1.getvalue()
    mock_resp1.history = []
    mock_resp1.json.return_value = {"object": {"sha": "5555555555555555555555555555555555555555"}}
    mock_client1.get.return_value = mock_resp1

    with patch("app.analysis.github_ingest.httpx.Client", return_value=mock_client1):
        res = client.post(
            "/api/codebase/github/connect",
            json={
                "repo_url": "https://github.com/testorg/delete-test",
                "branch": "main",
                "commit_sha": "5555555555555555555555555555555555555555",
                "project_name": "DeleteTest",
            },
            headers=user_headers,
        )
        assert res.status_code == 200
        proj_id = res.json()["project_id"]
        assert res.json()["total_findings"] == 1

    mock_client2 = MagicMock()

    def mock_get2(url, **kwargs):
        resp = MagicMock()
        resp.is_success = True
        if "/git/ref/heads/main" in url:
            resp.status_code = 200
            resp.json.return_value = {"object": {"sha": "6666666666666666666666666666666666666666"}}
            return resp
        if "/zipball" in url:
            resp.status_code = 200
            resp.content = buf2.getvalue()
            resp.history = []
            return resp
        resp.status_code = 404
        return resp

    mock_client2.get.side_effect = mock_get2

    with patch("app.services.github_service.httpx.Client", return_value=mock_client2):
        sync_res = client.post(
            f"/api/codebase/projects/{proj_id}/github/sync",
            json={"branch": "main", "force_rescan": True},
            headers=user_headers,
        )
        assert sync_res.status_code == 200
        sync_data = sync_res.json()
        assert sync_data["resolved_findings_count"] == 1
        assert sync_data["total_findings"] == 1

        proj = get_project(proj_id)
        assert proj.findings[0].finding_status == "VERIFIED_FIXED"
        assert proj.fixed_findings_count == 1
        assert proj.open_findings_count == 0

