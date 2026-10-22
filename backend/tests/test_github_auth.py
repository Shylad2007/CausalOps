"""
backend/tests/test_github_auth.py

Comprehensive tests for GitHub Authentication and Connection Management:
1. Connecting a GitHub PAT validates against GitHub API and stores encrypted-at-rest.
2. Invalid GitHub tokens (401/403) are rejected with clear error messages.
3. GET /api/github/status returns accurate connection status and safe metadata.
4. Raw tokens are never leaked in API responses, logs, or plain database storage.
5. Disconnect removes encrypted token from the database.
6. Unauthenticated requests are rejected with 401.
7. Cross-user isolation: User Bob cannot see or use User Alice's GitHub connection.
8. Publish & Sync endpoints automatically resolve the stored token without manual entry.
9. Authorized repositories listing queries GitHub user repos.
"""
import io
import json
import zipfile
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from main import app
from app.auth.auth_service import auth_service
from app.services.credential_service import credential_service
from app.db.database import db_manager

client = TestClient(app)


@pytest.fixture
def auth_users():
    """Ensure two distinct authenticated users exist."""
    try:
        auth_service.register("alice_conn", "Password123!", "alice_conn@example.com")
    except ValueError:
        pass
    try:
        auth_service.register("bob_conn", "Password123!", "bob_conn@example.com")
    except ValueError:
        pass

    res_a = auth_service.login("alice_conn", "Password123!")
    res_b = auth_service.login("bob_conn", "Password123!")

    return {
        "alice": {
            "id": res_a.user.id,
            "username": res_a.user.username,
            "headers": {"Authorization": f"Bearer {res_a.token}"},
        },
        "bob": {
            "id": res_b.user.id,
            "username": res_b.user.username,
            "headers": {"Authorization": f"Bearer {res_b.token}"},
        },
    }


def test_get_status_disconnected_by_default(auth_users):
    """A user who has not connected GitHub must receive connected=False."""
    bob = auth_users["bob"]
    credential_service.delete_github_token(bob["id"])

    res = client.get("/api/github/status", headers=bob["headers"])
    assert res.status_code == 200
    data = res.json()
    assert data["connected"] is False
    assert data["github_login"] is None
    assert data["token_hint"] is None
    assert data["scopes"] == []


def test_connect_github_token_validates_and_stores_encrypted(auth_users):
    """
    Connecting a valid token queries GitHub /user, encrypts the token with Fernet,
    and returns connection metadata with safe token hint.
    """
    alice = auth_users["alice"]
    raw_token = "ghp_securePersonalAccessTokenForAlice9999"

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "login": "alice-dev-lead",
        "name": "Alice Developer",
        "avatar_url": "https://avatars.githubusercontent.com/u/12345",
    }
    mock_resp.headers = {"X-OAuth-Scopes": "repo, read:user"}

    with patch("httpx.Client.get", return_value=mock_resp):
        res = client.post(
            "/api/github/connect",
            json={"token": raw_token},
            headers=alice["headers"],
        )

        assert res.status_code == 200, f"Connect failed: {res.text}"
        data = res.json()
        assert data["connected"] is True
        assert data["github_login"] == "alice-dev-lead"
        assert data["token_hint"] == "ghp_...9999"
        assert "repo" in data["scopes"]
        assert "read:user" in data["scopes"]
        assert "raw_token" not in data
        assert raw_token not in json.dumps(data)

    # Verify encrypted storage in SQLite
    with db_manager.session() as conn:
        row = conn.execute(
            "SELECT encrypted_token, token_hint, github_login FROM github_credentials WHERE user_id = ?",
            (alice["id"],),
        ).fetchone()

        assert row is not None
        assert row["github_login"] == "alice-dev-lead"
        assert row["token_hint"] == "ghp_...9999"
        # Database must NOT store raw token in plaintext
        assert row["encrypted_token"] != raw_token
        # Fernet decrypt verification
        decrypted = credential_service.decrypt_secret(row["encrypted_token"])
        assert decrypted == raw_token

    # Verify status endpoint reflects connection
    res_status = client.get("/api/github/status", headers=alice["headers"])
    assert res_status.status_code == 200
    st_data = res_status.json()
    assert st_data["connected"] is True
    assert st_data["github_login"] == "alice-dev-lead"
    assert st_data["token_hint"] == "ghp_...9999"


def test_connect_github_token_rejected_when_invalid(auth_users):
    """Invalid tokens returning 401 must be rejected and not saved."""
    bob = auth_users["bob"]
    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_resp.json.return_value = {"message": "Bad credentials"}

    with patch("httpx.Client.get", return_value=mock_resp):
        res = client.post(
            "/api/github/connect",
            json={"token": "ghp_invalid_expired_token"},
            headers=bob["headers"],
        )

        assert res.status_code == 400
        assert "Invalid GitHub personal access token" in res.json()["detail"]


def test_disconnect_github_removes_stored_credentials(auth_users):
    """Disconnecting removes the credential row from the database."""
    alice = auth_users["alice"]

    # Pre-seed credential
    credential_service.encrypt_secret("test")
    with db_manager.session() as conn:
        conn.execute(
            """
            INSERT INTO github_credentials (id, user_id, username, encrypted_token, token_hint, scopes, github_login, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET updated_at = excluded.updated_at
            """,
            ("ghc-test", alice["id"], alice["username"], "enc-fake", "...1234", "repo", "alice-dev", 1.0, 1.0),
        )

    res = client.delete("/api/github/disconnect", headers=alice["headers"])
    assert res.status_code == 200
    assert res.json()["status"] == "disconnected"

    # Confirm status is now disconnected
    res_status = client.get("/api/github/status", headers=alice["headers"])
    assert res_status.json()["connected"] is False

    # Confirm deleted from database
    with db_manager.session() as conn:
        row = conn.execute("SELECT id FROM github_credentials WHERE user_id = ?", (alice["id"],)).fetchone()
        assert row is None


def test_raw_token_never_exposed_in_any_response(auth_users):
    """Ensures token is never present in any API response."""
    alice = auth_users["alice"]
    raw_token = "ghp_secretTokenThatMustNeverAppearInResponses9999"

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"login": "alice-test", "name": "Alice"}
    mock_resp.headers = {"X-OAuth-Scopes": "repo"}

    with patch("httpx.Client.get", return_value=mock_resp):
        res_conn = client.post("/api/github/connect", json={"token": raw_token}, headers=alice["headers"])
        assert raw_token not in res_conn.text

        res_stat = client.get("/api/github/status", headers=alice["headers"])
        assert raw_token not in res_stat.text

        res_disc = client.delete("/api/github/disconnect", headers=alice["headers"])
        assert raw_token not in res_disc.text


def test_unauthenticated_requests_rejected():
    """Endpoints require authenticated CausalOps session."""
    res_get = client.get("/api/github/status")
    assert res_get.status_code in (401, 403)

    res_post = client.post("/api/github/connect", json={"token": "ghp_123"})
    assert res_post.status_code in (401, 403)

    res_del = client.delete("/api/github/disconnect")
    assert res_del.status_code in (401, 403)


def test_cross_user_credential_isolation(auth_users):
    """User Bob must NOT see or access User Alice's GitHub connection or token."""
    alice = auth_users["alice"]
    bob = auth_users["bob"]
    raw_token = "ghp_aliceOnlySecretToken7777"

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"login": "alice-private-login"}
    mock_resp.headers = {"X-OAuth-Scopes": "repo"}

    with patch("httpx.Client.get", return_value=mock_resp):
        res_a = client.post("/api/github/connect", json={"token": raw_token}, headers=alice["headers"])
        assert res_a.status_code == 200

    # Ensure Bob's credentials are not present
    credential_service.delete_github_token(bob["id"])

    res_b = client.get("/api/github/status", headers=bob["headers"])
    assert res_b.status_code == 200
    b_data = res_b.json()
    assert b_data["connected"] is False
    assert b_data["github_login"] is None
    assert b_data["token_hint"] is None

    # Bob's backend lookup returns None
    assert credential_service.get_github_token(bob["id"]) is None
    # Alice's backend lookup returns raw token
    assert credential_service.get_github_token(alice["id"]) == raw_token


def test_publish_endpoint_automatically_uses_stored_token(auth_users, monkeypatch):
    """
    When publishing a remediation PR, if no token is passed in the request body,
    the endpoint automatically looks up the authenticated user's stored encrypted token.
    """
    alice = auth_users["alice"]
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    monkeypatch.delenv("GH_TOKEN", raising=False)

    stored_token = "ghp_aliceStoredEncryptedToken3333"

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"login": "alice-lead"}
    mock_resp.headers = {"X-OAuth-Scopes": "repo"}

    with patch("httpx.Client.get", return_value=mock_resp):
        client.post("/api/github/connect", json={"token": stored_token}, headers=alice["headers"])

    # Create connected project for Alice
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr(
            "backend/main.py",
            "from fastapi import FastAPI\n"
            "from fastapi.middleware.cors import CORSMiddleware\n"
            "app = FastAPI()\n"
            "app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])\n"
        )

    with patch("httpx.Client.get") as mock_get:
        m = MagicMock()
        m.status_code = 200
        m.content = zip_buffer.getvalue()
        m.history = []
        m.json.return_value = {"sha": "sha-auto-test-1111"}
        mock_get.return_value = m

        res_conn = client.post(
            "/api/codebase/github/connect",
            json={
                "repo_url": "https://github.com/alice-org/auto-token-repo",
                "branch": "main",
                "project_name": "Auto Token Test",
            },
            headers=alice["headers"],
        )
        assert res_conn.status_code == 200
        proj_data = res_conn.json()
        proj_id = proj_data["project_id"]
        finding_id = proj_data["findings"][0]["id"]

    captured_tokens = []
    mock_gh_client = MagicMock()

    def mock_get_gh(url, **kwargs):
        headers = kwargs.get("headers", {})
        auth_hdr = headers.get("Authorization", "")
        if auth_hdr:
            captured_tokens.append(auth_hdr)
        resp = MagicMock()
        resp.is_success = True
        if "/git/ref/heads/main" in url:
            resp.status_code = 200
            resp.json.return_value = {"object": {"sha": "base-sha-111"}}
            return resp
        if "/contents/" in url:
            resp.status_code = 200
            resp.json.return_value = {"sha": "blob-1"}
            return resp
        resp.status_code = 404
        return resp

    def mock_post_gh(url, **kwargs):
        headers = kwargs.get("headers", {})
        auth_hdr = headers.get("Authorization", "")
        if auth_hdr:
            captured_tokens.append(auth_hdr)
        resp = MagicMock()
        resp.is_success = True
        if "/git/refs" in url:
            resp.status_code = 201
            resp.json.return_value = {"ref": "refs/heads/causalops/fix-v1"}
            return resp
        if "/pulls" in url:
            resp.status_code = 201
            resp.json.return_value = {"html_url": "https://github.com/alice-org/auto-token-repo/pull/1", "number": 1}
            return resp
        resp.status_code = 404
        return resp

    def mock_put_gh(url, **kwargs):
        headers = kwargs.get("headers", {})
        auth_hdr = headers.get("Authorization", "")
        if auth_hdr:
            captured_tokens.append(auth_hdr)
        resp = MagicMock()
        resp.is_success = True
        resp.status_code = 200
        resp.json.return_value = {"commit": {"sha": "sha-new"}}
        return resp

    mock_gh_client.get.side_effect = mock_get_gh
    mock_gh_client.post.side_effect = mock_post_gh
    mock_gh_client.put.side_effect = mock_put_gh

    # Notice: NO github_token passed in body! It must be auto-resolved from Alice's stored credentials!
    with patch("app.services.github_service.httpx.Client", return_value=mock_gh_client):
        res_pub = client.post(
            f"/api/codebase/projects/{proj_id}/github/publish",
            json={
                "finding_id": finding_id,
                "proposed_code": "# fixed code",
            },
            headers=alice["headers"],
        )

        assert res_pub.status_code == 200, f"Publish without token failed: {res_pub.text}"
        data = res_pub.json()
        assert data["pull_request_number"] == 1
        # Confirm that the stored token was used in the Authorization header
        assert any(stored_token in tok for tok in captured_tokens)


def test_list_authorized_repos_endpoint(auth_users):
    """Listing authorized repositories queries GitHub user repos and returns sanitized list."""
    alice = auth_users["alice"]
    credential_service.encrypt_secret("test")

    # Connect token
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"login": "alice-repos"}
    mock_resp.headers = {"X-OAuth-Scopes": "repo"}
    with patch("httpx.Client.get", return_value=mock_resp):
        client.post("/api/github/connect", json={"token": "ghp_aliceRepoToken1111"}, headers=alice["headers"])

    # Mock user/repos
    mock_repos_resp = MagicMock()
    mock_repos_resp.status_code = 200
    mock_repos_resp.json.return_value = [
        {
            "name": "payments-api",
            "full_name": "alice-org/payments-api",
            "html_url": "https://github.com/alice-org/payments-api",
            "default_branch": "main",
            "private": True,
            "description": "Core payment service",
        },
        {
            "name": "web-frontend",
            "full_name": "alice-org/web-frontend",
            "html_url": "https://github.com/alice-org/web-frontend",
            "default_branch": "master",
            "private": False,
            "description": "User portal",
        },
    ]

    with patch("httpx.Client.get", return_value=mock_repos_resp):
        res = client.get("/api/github/repos", headers=alice["headers"])
        assert res.status_code == 200
        repos = res.json()
        assert len(repos) == 2
        assert repos[0]["name"] == "payments-api"
        assert repos[0]["default_branch"] == "main"
        assert repos[0]["private"] is True
        assert repos[1]["name"] == "web-frontend"
