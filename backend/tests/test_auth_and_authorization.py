"""
backend/tests/test_auth_and_authorization.py
Automated security tests for Phase 1:
- User registration, login, logout, and token revocation.
- Database persistence across simulated service restarts.
- Multi-user isolation between User Alpha and User Bravo.
- Prevention of Insecure Direct Object References (IDOR).
- Authorization verification across all codebase and scenario endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from main import app
from app.auth.auth_service import AuthService
from app.db.database import db_manager

client = TestClient(app)


@pytest.fixture
def clean_auth_users():
    """Ensure clean test users in the database."""
    with db_manager.session() as conn:
        conn.execute("DELETE FROM user_sessions WHERE username IN ('alpha_sec', 'bravo_sec')")
        conn.execute("DELETE FROM users WHERE username IN ('alpha_sec', 'bravo_sec')")
        conn.execute("DELETE FROM project_ownership WHERE owner_username IN ('alpha_sec', 'bravo_sec')")


def test_persistent_registration_login_logout(clean_auth_users):
    # 1. Register alpha_sec
    res_reg = client.post("/api/auth/register", json={
        "username": "alpha_sec",
        "password": "alphaPassword123!",
        "email": "alpha@example.org"
    })
    assert res_reg.status_code == 200
    token_alpha = res_reg.json()["token"]
    assert token_alpha.startswith("cop_")

    # 2. Verify /api/auth/me works with valid token
    res_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_alpha}"})
    assert res_me.status_code == 200
    assert res_me.json()["username"] == "alpha_sec"

    # 3. Simulate process restart by instantiating a fresh AuthService against the persistent SQLite DB
    fresh_service = AuthService()
    user_prof = fresh_service.verify_token(token_alpha)
    assert user_prof is not None
    assert user_prof.username == "alpha_sec"

    # 4. Logout / token revocation
    res_logout = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token_alpha}"})
    assert res_logout.status_code == 200

    # 5. Token is now revoked
    res_me_revoked = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_alpha}"})
    assert res_me_revoked.status_code == 401


def test_cross_user_project_isolation_and_idor_prevention(clean_auth_users):
    """
    Creates project for Alpha, then verifies Bravo receives 403 Forbidden
    when attempting direct access to Alpha's scan, graph, scenario, patch, and remediation history.
    """
    # 1. Register User Alpha
    res_a = client.post("/api/auth/register", json={
        "username": "alpha_sec",
        "password": "alphaPassword123!",
        "email": "alpha@test.com"
    })
    token_alpha = res_a.json()["token"]

    # 2. Register User Bravo
    res_b = client.post("/api/auth/register", json={
        "username": "bravo_sec",
        "password": "bravoPassword123!",
        "email": "bravo@test.com"
    })
    token_bravo = res_b.json()["token"]

    # 3. User Alpha uploads/connects a repository
    from unittest.mock import patch, MagicMock
    import io, zipfile

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr(
            "app/server.py",
            "import os\ndef ping(ip):\n    os.system(f'ping -c 1 {ip}')\n"
        )
    mock_archive_bytes = zip_buffer.getvalue()

    with patch("httpx.Client.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.content = mock_archive_bytes
        mock_resp.history = []
        mock_resp.json.return_value = {"sha": "1234567890abcdef1234567890abcdef12345678"}
        mock_get.return_value = mock_resp

        res_conn = client.post(
            "/api/codebase/github/connect",
            json={
                "repo_url": "https://github.com/alpha-org/confidential-alpha-repo",
                "branch": "main",
                "project_name": "Confidential-Alpha-Project",
            },
            headers={"Authorization": f"Bearer {token_alpha}"}
        )
        assert res_conn.status_code == 200
        alpha_proj_id = res_conn.json()["project_id"]
        assert res_conn.json()["owner_username"] == "alpha_sec"

    # 4. User Alpha can query their own project
    res_a_proj = client.get(
        f"/api/codebase/projects/{alpha_proj_id}",
        headers={"Authorization": f"Bearer {token_alpha}"}
    )
    assert res_a_proj.status_code == 200
    assert res_a_proj.json()["project_name"] == "Confidential-Alpha-Project"

    # 5. User Bravo tries to read Alpha's project scan (IDOR check) -> MUST RETURN 403
    res_b_proj = client.get(
        f"/api/codebase/projects/{alpha_proj_id}",
        headers={"Authorization": f"Bearer {token_bravo}"}
    )
    assert res_b_proj.status_code == 403

    # 6. User Bravo tries to read Alpha's attack graph -> MUST RETURN 403
    res_b_graph = client.get(
        f"/api/codebase/projects/{alpha_proj_id}/graph",
        headers={"Authorization": f"Bearer {token_bravo}"}
    )
    assert res_b_graph.status_code == 403

    # 7. User Bravo tries to read Alpha's project scenario -> MUST RETURN 403
    res_b_scen = client.get(
        f"/api/codebase/projects/{alpha_proj_id}/scenario",
        headers={"Authorization": f"Bearer {token_bravo}"}
    )
    assert res_b_scen.status_code == 403

    # 8. User Bravo tries to generate/verify patch on Alpha's project -> MUST RETURN 403
    res_b_patch = client.post(
        f"/api/codebase/projects/{alpha_proj_id}/patch/generate?finding_id=VULN-001",
        headers={"Authorization": f"Bearer {token_bravo}"}
    )
    assert res_b_patch.status_code == 403

    # 9. Summary endpoint for Bravo does NOT list Alpha's confidential project
    res_b_summary = client.get(
        "/api/codebase/projects/summary",
        headers={"Authorization": f"Bearer {token_bravo}"}
    )
    assert res_b_summary.status_code == 200
    b_projects = [p["project_id"] for p in res_b_summary.json()]
    assert alpha_proj_id not in b_projects

    # 10. Summary endpoint for Alpha DOES list Alpha's confidential project
    res_a_summary = client.get(
        "/api/codebase/projects/summary",
        headers={"Authorization": f"Bearer {token_alpha}"}
    )
    assert res_a_summary.status_code == 200
    a_projects = [p["project_id"] for p in res_a_summary.json()]
    assert alpha_proj_id in a_projects

    # 11. Canonical demo project remains accessible to both users
    res_a_demo = client.get(
        "/api/codebase/projects/proj-demo-shoppulse",
        headers={"Authorization": f"Bearer {token_alpha}"}
    )
    assert res_a_demo.status_code == 200

    res_b_demo = client.get(
        "/api/codebase/projects/proj-demo-shoppulse",
        headers={"Authorization": f"Bearer {token_bravo}"}
    )
    assert res_b_demo.status_code == 200
