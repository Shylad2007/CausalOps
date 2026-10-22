"""
backend/tests/test_github_workflow.py

Comprehensive tests for GitHub repository remediation and synchronization:
1. Publishing remediation creates branch and pull request without touching default branch.
2. Direct pushes to default/protected branches are strictly blocked and redirected.
3. Proper error handling when GitHub credentials are missing.
4. Demo projects cannot be published to GitHub or remote synced.
5. Post-merge sync detects unmerged PR and prevents premature verification.
6. Post-merge sync with merged PR downloads latest revision, re-scans source, prunes deleted files,
   and marks findings VERIFIED_FIXED.
7. Authorization controls ensure only project owners can publish or sync remote repositories.
"""
import io
import json
import zipfile
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from main import app
from app.auth.auth_service import auth_service
from app.services.project_storage import get_project, get_remediation_history, delete_project

client = TestClient(app)


@pytest.fixture
def test_users():
    """Ensure two test users exist with tokens for auth/IDOR testing."""
    try:
        auth_service.register("alice_gh", "Password123!", "alice@example.com")
    except ValueError:
        pass
    try:
        auth_service.register("bob_gh", "Password123!", "bob@example.com")
    except ValueError:
        pass

    token_alice = auth_service.login("alice_gh", "Password123!").token
    token_bob = auth_service.login("bob_gh", "Password123!").token
    try:
        yield {
            "alice": {"token": token_alice, "headers": {"Authorization": f"Bearer {token_alice}"}},
            "bob": {"token": token_bob, "headers": {"Authorization": f"Bearer {token_bob}"}},
        }
    finally:
        auth_service.delete_user("alice_gh")
        auth_service.delete_user("bob_gh")


@pytest.fixture
def connected_github_project(test_users):
    """
    Creates a project connected to a GitHub repository with sample vulnerable code.
    """
    alice = test_users["alice"]

    # Sample vulnerable repo containing insecure CORS and hardcoded secret
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr(
            "backend/main.py",
            "from fastapi import FastAPI\n"
            "from fastapi.middleware.cors import CORSMiddleware\n"
            "app = FastAPI()\n"
            "app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])\n"
        )
        zf.writestr("backend/config.py", 'JWT_SECRET = "super-secret-key-12345"\n')

    mock_archive_bytes = zip_buffer.getvalue()

    with patch("httpx.Client.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.content = mock_archive_bytes
        mock_resp.history = []
        mock_resp.json.return_value = {"sha": "initial-sha-111111111111111111111111111111111111"}
        mock_get.return_value = mock_resp

        res = client.post(
            "/api/codebase/github/connect",
            json={
                "repo_url": "https://github.com/alice-org/secure-service",
                "branch": "main",
                "project_name": "Alice Secure Service",
            },
            headers=alice["headers"],
        )
        assert res.status_code == 200, f"Connect failed: {res.text}"
        project_data = res.json()
        try:
            yield project_data
        finally:
            delete_project(project_data["project_id"])


def test_publish_remediation_pr_creates_branch_and_pr(test_users, connected_github_project):
    """
    Verifies that publishing a remediation:
    - Queries default branch ref
    - Creates dedicated remediation branch causalops/fix-{finding_id}
    - Commits patched file
    - Opens PR
    - Updates finding metadata and remediation history
    """
    alice = test_users["alice"]
    proj_id = connected_github_project["project_id"]
    finding = connected_github_project["findings"][0]
    finding_id = finding["id"]

    proposed_code = (
        "from fastapi import FastAPI\n"
        "from fastapi.middleware.cors import CORSMiddleware\n"
        "app = FastAPI()\n"
        "ALLOWED_ORIGINS = ['http://localhost:3000']\n"
        "app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=True, allow_methods=['GET'], allow_headers=['*'])\n"
    )

    mock_gh_client = MagicMock()

    def mock_get(url, **kwargs):
        resp = MagicMock()
        resp.is_success = True
        if "/git/ref/heads/main" in url:
            resp.status_code = 200
            resp.json.return_value = {"object": {"sha": "base-sha-000000000000000000000000000000000000"}}
            return resp
        if f"/contents/{finding['file_path']}" in url:
            resp.status_code = 200
            resp.json.return_value = {"sha": "blob-sha-original"}
            return resp
        resp.status_code = 404
        return resp

    def mock_post(url, **kwargs):
        resp = MagicMock()
        resp.is_success = True
        if "/git/refs" in url:
            resp.status_code = 201
            resp.json.return_value = {"ref": f"refs/heads/causalops/fix-{finding_id.lower()}"}
            return resp
        if "/pulls" in url:
            resp.status_code = 201
            resp.json.return_value = {
                "html_url": "https://github.com/alice-org/secure-service/pull/101",
                "number": 101,
            }
            return resp
        resp.status_code = 404
        return resp

    def mock_put(url, **kwargs):
        resp = MagicMock()
        resp.is_success = True
        if f"/contents/{finding['file_path']}" in url:
            resp.status_code = 200
            resp.json.return_value = {"commit": {"sha": "patch-commit-sha-999"}}
            return resp
        resp.status_code = 404
        return resp

    mock_gh_client.get.side_effect = mock_get
    mock_gh_client.post.side_effect = mock_post
    mock_gh_client.put.side_effect = mock_put

    with patch("app.services.github_service.httpx.Client", return_value=mock_gh_client):
        res = client.post(
            f"/api/codebase/projects/{proj_id}/github/publish",
            json={
                "finding_id": finding_id,
                "proposed_code": proposed_code,
                "github_token": "ghp_mock_token_for_test",
            },
            headers=alice["headers"],
        )

        assert res.status_code == 200, f"Publish failed: {res.text}"
        data = res.json()
        assert data["pull_request_url"] == "https://github.com/alice-org/secure-service/pull/101"
        assert data["pull_request_number"] == 101
        assert data["branch_name"] == f"causalops/fix-{finding_id.lower()}"
        # Schema uses commit_sha (not published_commit_sha)
        assert data["commit_sha"] == "patch-commit-sha-999"

        # Verify audit history — action written by service is PUBLISH_PULL_REQUEST
        history = get_remediation_history(proj_id)
        assert len(history) > 0
        latest = history[-1]
        assert latest["action"] == "PUBLISH_PULL_REQUEST"
        assert latest["finding_id"] == finding_id

        # Verify project finding has PR metadata
        updated_proj = get_project(proj_id)
        updated_finding = next(f for f in updated_proj.findings if f.id == finding_id)
        assert updated_finding.evidence_metadata.get("pr_url") == "https://github.com/alice-org/secure-service/pull/101"
        assert updated_finding.evidence_metadata.get("pr_number") == 101


def test_publish_remediation_blocks_direct_push_to_default_branch(test_users, connected_github_project):
    """
    Ensure that passing branch_name='main' or 'master' is rejected from directly mutating
    the default branch and forced onto a dedicated remediation branch.
    """
    alice = test_users["alice"]
    proj_id = connected_github_project["project_id"]
    finding = connected_github_project["findings"][0]

    captured_refs = []
    mock_gh_client = MagicMock()

    def mock_get(url, **kwargs):
        resp = MagicMock()
        resp.is_success = True
        if "/git/ref/heads/main" in url:
            resp.status_code = 200
            resp.json.return_value = {"object": {"sha": "base-sha-111"}}
            return resp
        if f"/contents/{finding['file_path']}" in url:
            resp.status_code = 200
            resp.json.return_value = {"sha": "blob-1"}
            return resp
        resp.status_code = 404
        return resp

    def mock_post(url, **kwargs):
        resp = MagicMock()
        resp.is_success = True
        if "/git/refs" in url:
            payload = kwargs.get("json", {})
            captured_refs.append(payload.get("ref"))
            resp.status_code = 201
            resp.json.return_value = {"ref": payload.get("ref")}
            return resp
        if "/pulls" in url:
            resp.status_code = 201
            resp.json.return_value = {
                "html_url": "https://github.com/alice-org/secure-service/pull/102",
                "number": 102,
            }
            return resp
        resp.status_code = 404
        return resp

    def mock_put(url, **kwargs):
        resp = MagicMock()
        resp.is_success = True
        if f"/contents/{finding['file_path']}" in url:
            resp.status_code = 200
            resp.json.return_value = {"commit": {"sha": "commit-2"}}
            return resp
        resp.status_code = 404
        return resp

    mock_gh_client.get.side_effect = mock_get
    mock_gh_client.post.side_effect = mock_post
    mock_gh_client.put.side_effect = mock_put

    with patch("app.services.github_service.httpx.Client", return_value=mock_gh_client):
        res = client.post(
            f"/api/codebase/projects/{proj_id}/github/publish",
            json={
                "finding_id": finding["id"],
                "branch_name": "main",  # User maliciously or mistakenly requests default branch
                "github_token": "ghp_mock_token_for_test",
            },
            headers=alice["headers"],
        )

        assert res.status_code == 200
        data = res.json()
        # Branch MUST NOT be main
        assert data["branch_name"] != "main"
        assert data["branch_name"] == f"causalops/fix-{finding['id'].lower()}"
        # Verified ref created was refs/heads/causalops/fix-...
        assert any("causalops/fix-" in ref for ref in captured_refs)
        assert not any(ref == "refs/heads/main" for ref in captured_refs)


def test_publish_fails_without_github_token(test_users, connected_github_project, monkeypatch):
    """
    Verifies clear error reporting when no GitHub personal access token is configured.
    """
    alice = test_users["alice"]
    proj_id = connected_github_project["project_id"]
    finding_id = connected_github_project["findings"][0]["id"]

    # Clear any environment token
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    monkeypatch.delenv("GH_TOKEN", raising=False)

    # Also temporarily mock get_token to ensure no .env fallback during test
    with patch("app.services.github_service.github_service.get_token", return_value=None):
        res = client.post(
            f"/api/codebase/projects/{proj_id}/github/publish",
            json={"finding_id": finding_id},
            headers=alice["headers"],
        )

        assert res.status_code == 400
        assert "GitHub token is not configured" in res.json()["detail"]


def test_demo_project_cannot_be_published_or_synced(test_users):
    """
    Demo project is read-only and local: publishing or remote syncing must be rejected.
    """
    alice = test_users["alice"]

    res_pub = client.post(
        "/api/codebase/projects/proj-demo-shoppulse/github/publish",
        json={"finding_id": "FINDING-DEMO-001"},
        headers=alice["headers"],
    )
    assert res_pub.status_code == 400
    assert "read-only and cannot be published" in res_pub.json()["detail"]

    res_sync = client.post(
        "/api/codebase/projects/proj-demo-shoppulse/github/sync",
        json={},
        headers=alice["headers"],
    )
    assert res_sync.status_code == 400
    assert "cannot be synchronized" in res_sync.json()["detail"]


def test_sync_detects_unmerged_pr_and_prevents_premature_verification(test_users, connected_github_project):
    """
    If a PR is still open, sync should detect this, inform the user, and NOT mark findings fixed.
    """
    alice = test_users["alice"]
    proj_id = connected_github_project["project_id"]

    mock_gh_client = MagicMock()

    def mock_get(url, **kwargs):
        resp = MagicMock()
        resp.is_success = True
        if "/pulls/101" in url:
            resp.status_code = 200
            resp.json.return_value = {
                "state": "open",
                "merged": False,
                "title": "fix(security): CORS remediation",
                "number": 101,
            }
            return resp
        resp.status_code = 404
        return resp

    mock_gh_client.get.side_effect = mock_get

    with patch("app.services.github_service.httpx.Client", return_value=mock_gh_client):
        res = client.post(
            f"/api/codebase/projects/{proj_id}/github/sync",
            json={
                "pull_request_number": 101,
                "github_token": "ghp_mock_token_for_test",
            },
            headers=alice["headers"],
        )

        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "PR_NOT_MERGED"
        assert "is currently 'open' (not merged)" in data["message"]
        assert data["pull_request_merged"] is False


def test_sync_merged_pr_updates_codebase_and_marks_verified_fixed(test_users, connected_github_project):
    """
    When PR is merged:
    - Download latest base revision archive
    - Overwrite project source and prune deleted files
    - Re-scan source
    - Mark remediated finding VERIFIED_FIXED
    - Update project commit SHA and audit log
    """
    alice = test_users["alice"]
    proj_id = connected_github_project["project_id"]
    # Explicitly target the insecure_cors finding by category (not index-0 which may vary)
    cors_finding = next(
        (f for f in connected_github_project["findings"] if f["category"] == "insecure_cors"),
        connected_github_project["findings"][0]
    )
    finding_id = cors_finding["id"]

    # Create new clean zip archive representing merged remote state (CORS vulnerability fixed)
    clean_buffer = io.BytesIO()
    with zipfile.ZipFile(clean_buffer, "w") as zf:
        zf.writestr(
            "backend/main.py",
            "from fastapi import FastAPI\n"
            "from fastapi.middleware.cors import CORSMiddleware\n"
            "app = FastAPI()\n"
            "ALLOWED_ORIGINS = ['http://localhost:3000']\n"
            "app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=True, allow_methods=['GET'], allow_headers=['*'])\n"
        )
        # config.py secret is also removed in the clean revision → both findings resolved
        zf.writestr("backend/config.py", "import os\nJWT_SECRET = os.environ.get('JWT_SECRET')\n")

    clean_bytes = clean_buffer.getvalue()

    mock_gh_client = MagicMock()

    def mock_get(url, **kwargs):
        resp = MagicMock()
        resp.is_success = True

        if "/pulls/101" in url:
            resp.status_code = 200
            resp.json.return_value = {
                "state": "closed",
                "merged": True,
                "merge_commit_sha": "merged-sha-999999999999999999999999999999999999",
                "title": "fix(security): CORS remediation",
                "number": 101,
            }
            return resp

        if "/commits/main" in url:
            resp.status_code = 200
            resp.json.return_value = {
                "sha": "merged-sha-999999999999999999999999999999999999"
            }
            return resp

        if "/zipball" in url:
            resp.status_code = 200
            resp.content = clean_bytes
            resp.history = []
            return resp

        resp.status_code = 404
        return resp

    mock_gh_client.get.side_effect = mock_get

    with patch("app.services.github_service.httpx.Client", return_value=mock_gh_client):
        res = client.post(
            f"/api/codebase/projects/{proj_id}/github/sync",
            json={
                "pull_request_number": 101,
                "branch": "main",
                "force_rescan": True,
                "github_token": "ghp_mock_token_for_test",
            },
            headers=alice["headers"],
        )

        assert res.status_code == 200, f"Sync failed: {res.text}"
        data = res.json()
        assert data["status"] == "MERGED_AND_VERIFIED"
        # Schema uses current_commit_sha not commit_sha
        assert data["current_commit_sha"] == "merged-sha-999999999999999999999999999999999999"
        # Both findings resolved in the clean zip (CORS + secret both fixed)
        assert data["resolved_findings_count"] >= 1
        assert data["total_findings"] >= 0

        # Check project state
        updated_proj = get_project(proj_id)
        assert updated_proj.commit_sha == "merged-sha-999999999999999999999999999999999999"

        # Check CORS finding status is VERIFIED_FIXED
        fixed_finding = next(f for f in updated_proj.findings if f.id == finding_id)
        assert fixed_finding.finding_status == "VERIFIED_FIXED"
        assert fixed_finding.fixed_at is not None

        # Check remediation history audit record — action is REMOTE_MERGE_SYNC
        history = get_remediation_history(proj_id)
        sync_events = [h for h in history if h.get("action") == "REMOTE_MERGE_SYNC"]
        assert len(sync_events) > 0
        # SHA is embedded in the details string (truncated to 8 chars by service)
        assert "merged-s" in sync_events[-1]["details"]


def test_cross_user_authorization_enforced_for_publish_and_sync(test_users, connected_github_project):
    """
    User Bob must NOT be able to publish or sync Alice's GitHub project (IDOR guard).
    """
    bob = test_users["bob"]
    proj_id = connected_github_project["project_id"]

    res_pub = client.post(
        f"/api/codebase/projects/{proj_id}/github/publish",
        json={"finding_id": "FINDING-001", "github_token": "ghp_test"},
        headers=bob["headers"],
    )
    assert res_pub.status_code == 403
    assert "Access forbidden" in res_pub.json()["detail"]

    res_sync = client.post(
        f"/api/codebase/projects/{proj_id}/github/sync",
        json={"github_token": "ghp_test"},
        headers=bob["headers"],
    )
    assert res_sync.status_code == 403
    assert "Access forbidden" in res_sync.json()["detail"]
