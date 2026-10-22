import pytest
from fastapi.testclient import TestClient
from main import app
from app.db.database import db_manager

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_secops_user():
    with db_manager.session() as conn:
        conn.execute("DELETE FROM user_sessions WHERE username = 'secops_lead'")
        conn.execute("DELETE FROM users WHERE username = 'secops_lead'")

def test_auth_registration_and_login_flow():
    # 1. Register new user
    reg_payload = {
        "username": "secops_lead",
        "password": "securepassword123",
        "email": "lead@security.org"
    }
    res_reg = client.post("/api/auth/register", json=reg_payload)
    assert res_reg.status_code == 200
    data_reg = res_reg.json()
    assert "token" in data_reg
    assert data_reg["user"]["username"] == "secops_lead"

    token = data_reg["token"]

    # 2. Check /me with valid token
    res_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res_me.status_code == 200
    assert res_me.json()["username"] == "secops_lead"

    # 3. Duplicate registration should fail with 400
    res_dup = client.post("/api/auth/register", json=reg_payload)
    assert res_dup.status_code == 400

    # 4. Login with correct password
    login_payload = {
        "username": "secops_lead",
        "password": "securepassword123"
    }
    res_login = client.post("/api/auth/login", json=login_payload)
    assert res_login.status_code == 200
    assert "token" in res_login.json()

    # 5. Login with invalid password fails with 401
    bad_login = {
        "username": "secops_lead",
        "password": "wrongpassword"
    }
    res_bad = client.post("/api/auth/login", json=bad_login)
    assert res_bad.status_code == 401


def test_auth_service_does_not_seed_default_user_on_startup():
    from app.auth.auth_service import AuthService
    service = AuthService()
    # Ensure there is no automatic hardcoded backdoor seeding in clean db
    test_user_id = "random_unregistered_analyst"
    with pytest.raises(ValueError):
        service.login(test_user_id, "password123")
