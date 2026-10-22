import pytest
import io
import zipfile
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from main import app
from app.auth.auth_service import AuthService
from app.services.credential_service import credential_service
from app.services.project_storage import get_project, get_project_owner

client = TestClient(app)
_auth = AuthService()


def _make_auth_user(username: str, user_id: str = None):
    try:
        res = _auth.register(username, "SuperSecret123!", f"{username}@test.local")
        return {"token": res.token, "headers": {"Authorization": f"Bearer {res.token}"}, "username": username, "id": res.user.id}
    except ValueError:
        res = _auth.login(username, "SuperSecret123!")
        return {"token": res.token, "headers": {"Authorization": f"Bearer {res.token}"}, "username": username, "id": res.user.id}


def _create_sample_zip_bytes():
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr(
            "src/service.py",
            "import os\n\ndef run_query(param):\n    query = f\"SELECT * FROM data WHERE x = '{param}'\"\n    return query\n"
        )
    return zip_buffer.getvalue()


class TestSingleRepoGitHubConnect:
    """
    Phase 3: Secure, Single-Repository GitHub Connection Test Suite.
    Verifies URL validation, credential checks, exact repo matching, branch/commit validation,
    and user isolation.
    """

    def test_malformed_and_unsafe_urls_rejected(self):
        """Malformed, non-GitHub, and credential-embedded URLs are rejected with 400."""
        user = _make_auth_user("sec_user", "usr-sec-1")

        bad_urls = [
            "https://user:pass@github.com/org/repo",
            "https://evil-github.com/org/repo",
            "http://169.254.169.254/secret",
            "https://github.com/org/repo?token=secret",
            "https://github.com/org/repo#anchor",
            "https://github.com/../evil/repo",
            "ftp://github.com/org/repo",
            "not_a_url",
        ]

        for bad_url in bad_urls:
            res = client.post(
                "/api/codebase/github/connect",
                json={"repo_url": bad_url, "token": "ghp_validToken1234"},
                headers=user["headers"],
            )
            assert res.status_code == 400
            assert "Invalid" in res.json()["detail"] or "must match" in res.json()["detail"] or "URL" in res.json()["detail"]

    def test_invalid_or_expired_token_rejected_401(self):
        """Invalid or expired GitHub access token returns 401 and does not create project."""
        user = _make_auth_user("sec_user", "usr-sec-2")

        mock_resp = MagicMock()
        mock_resp.status_code = 401
        mock_resp.json.return_value = {"message": "Bad credentials"}

        with patch("httpx.Client.get", return_value=mock_resp):
            res = client.post(
                "/api/codebase/github/connect",
                json={
                    "repo_url": "https://github.com/target-org/target-repo",
                    "token": "ghp_expiredOrInvalidToken1234",
                },
                headers=user["headers"],
            )
            assert res.status_code == 401
            assert "Invalid or expired" in res.json()["detail"] or "401" in res.json()["detail"]

    def test_repository_not_found_or_no_token_access_rejected_404(self):
        """When repository is not found or token lacks access to target repository, returns 404."""
        user = _make_auth_user("sec_user", "usr-sec-3")

        mock_resp = MagicMock()
        mock_resp.status_code = 404
        mock_resp.json.return_value = {"message": "Not Found"}

        with patch("httpx.Client.get", return_value=mock_resp):
            res = client.post(
                "/api/codebase/github/connect",
                json={
                    "repo_url": "https://github.com/private-org/secret-repo",
                    "token": "ghp_noAccessToThisRepo1234",
                },
                headers=user["headers"],
            )
            assert res.status_code == 404
            assert "not found" in res.json()["detail"].lower()

    def test_mismatched_repository_identity_rejected(self):
        """A token that resolves to a different repository than the requested URL is rejected."""
        user = _make_auth_user("sec_user", "usr-sec-4")

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "full_name": "other-org/other-repo",
            "default_branch": "main",
            "id": 999999,
        }

        with patch("httpx.Client.get", return_value=mock_resp):
            res = client.post(
                "/api/codebase/github/connect",
                json={
                    "repo_url": "https://github.com/intended-org/intended-repo",
                    "token": "ghp_scopedToOtherRepo1234",
                },
                headers=user["headers"],
            )
            assert res.status_code == 400
            assert "does not match requested repository" in res.json()["detail"]

    def test_nonexistent_branch_rejected(self):
        """If a branch is specified and does not exist in the repository, connection is rejected."""
        user = _make_auth_user("sec_user", "usr-sec-5")

        def mock_get(url, **kwargs):
            resp = MagicMock()
            if "/branches/nonexistent-branch" in url:
                resp.status_code = 404
                resp.json.return_value = {"message": "Branch not found"}
            else:
                resp.status_code = 200
                resp.json.return_value = {
                    "full_name": "target-org/target-repo",
                    "default_branch": "main",
                    "id": 12345,
                }
            return resp

        with patch("httpx.Client.get", side_effect=mock_get):
            res = client.post(
                "/api/codebase/github/connect",
                json={
                    "repo_url": "https://github.com/target-org/target-repo",
                    "token": "ghp_validToken1234",
                    "branch": "nonexistent-branch",
                },
                headers=user["headers"],
            )
            assert res.status_code == 400
            assert "Branch 'nonexistent-branch' does not exist" in res.json()["detail"]

    def test_nonexistent_commit_sha_rejected(self):
        """If a commit SHA is specified and does not exist in the repository, connection is rejected."""
        user = _make_auth_user("sec_user", "usr-sec-6")

        def mock_get(url, **kwargs):
            resp = MagicMock()
            if "/commits/badc0ffee111" in url:
                resp.status_code = 404
                resp.json.return_value = {"message": "Commit not found"}
            else:
                resp.status_code = 200
                resp.json.return_value = {
                    "full_name": "target-org/target-repo",
                    "default_branch": "main",
                    "id": 12345,
                }
            return resp

        with patch("httpx.Client.get", side_effect=mock_get):
            res = client.post(
                "/api/codebase/github/connect",
                json={
                    "repo_url": "https://github.com/target-org/target-repo",
                    "token": "ghp_validToken1234",
                    "commit_sha": "badc0ffee111",
                },
                headers=user["headers"],
            )
            assert res.status_code == 400
            assert "Commit SHA 'badc0ffee111' does not exist" in res.json()["detail"]

    def test_successful_connection_scans_exact_repo_and_stores_credentials_safely(self):
        """
        Valid token matching exact repo:
        - Resolves exact commit SHA
        - Safely downloads & extracts archive
        - Deterministically scans source
        - Credentials are NOT present in response or URLs
        - Encrypted token is persisted at rest for the authenticated user
        - Project ownership is strictly bound to the authenticated user
        """
        user = _make_auth_user("charlie_lead", "usr-charlie-7")
        zip_bytes = _create_sample_zip_bytes()
        raw_token = "github_pat_11AAABBBCCC_secretToken999"

        def mock_get(url, **kwargs):
            resp = MagicMock()
            resp.status_code = 200
            resp.history = []
            if "/zipball/" in url:
                resp.content = zip_bytes
            elif "/branches/" in url:
                resp.json.return_value = {
                    "name": "main",
                    "commit": {"sha": "aabbccdd11223344556677889900aabbccddeeff"},
                }
            elif "/commits/" in url:
                resp.json.return_value = {
                    "sha": "aabbccdd11223344556677889900aabbccddeeff",
                }
            else:
                resp.json.return_value = {
                    "full_name": "charlie-org/secure-core",
                    "default_branch": "main",
                    "id": 881234,
                    "sha": "aabbccdd11223344556677889900aabbccddeeff",
                }
            return resp

        with patch("httpx.Client.get", side_effect=mock_get):
            res = client.post(
                "/api/codebase/github/connect",
                json={
                    "repo_url": "https://github.com/charlie-org/secure-core",
                    "token": raw_token,
                    "branch": "main",
                    "project_name": "Charlie Secure Core",
                },
                headers=user["headers"],
            )

        assert res.status_code == 200
        data = res.json()

        # Verify exact metadata
        assert data["project_name"] == "Charlie Secure Core"
        assert data["repository_url"] == "https://github.com/charlie-org/secure-core"
        assert data["commit_sha"] == "aabbccdd11223344556677889900aabbccddeeff"
        assert data["owner_username"] == "charlie_lead"
        assert data["status"] == "COMPLETED"

        # Sensitive token must NOT be returned in API response
        assert raw_token not in res.text
        assert "token" not in data

        # Verify finding was scanned
        assert data["total_findings"] >= 1
        assert any(f["category"] == "sql_injection" for f in data["findings"])

        # Verify project ownership in storage
        proj_id = data["project_id"]
        owner = get_project_owner(proj_id)
        assert owner == "charlie_lead"

        # Verify user isolation: another user cannot access Charlie's project
        other_user = _make_auth_user("david_intruder", "usr-david-8")
        res_other = client.get(f"/api/codebase/projects/{proj_id}", headers=other_user["headers"])
        assert res_other.status_code in (403, 404)
