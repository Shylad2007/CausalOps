import pytest
import io
import zipfile
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from main import app
from app.analysis.github_ingest import GitHubIngestService

client = TestClient(app)


def test_ssrf_prevention_and_url_validation():
    """
    Ensures strict validation of GitHub URLs and rejection of internal IPs/domains (SSRF).
    """
    # Valid GitHub URLs
    url, owner, repo = GitHubIngestService.validate_and_parse_url("https://github.com/we45/Vulnerable-Flask-App")
    assert url == "https://github.com/we45/Vulnerable-Flask-App"
    assert owner == "we45"
    assert repo == "Vulnerable-Flask-App"

    url2, owner2, repo2 = GitHubIngestService.validate_and_parse_url("https://github.com/OWASP/NodeGoat.git/")
    assert url2 == "https://github.com/OWASP/NodeGoat"
    assert owner2 == "OWASP"
    assert repo2 == "NodeGoat"

    # Malicious or internal URLs must be rejected (SSRF prevention)
    ssrf_attacks = [
        "http://localhost:8000/repo",
        "http://127.0.0.1/admin",
        "http://169.254.169.254/latest/meta-data/",
        "https://evil.com/fake/repo",
        "https://github.com.evil.com/owner/repo",
        "ftp://github.com/owner/repo",
        "file:///etc/passwd",
        "https://github.com/../evil/repo",
    ]
    for bad_url in ssrf_attacks:
        with pytest.raises(ValueError):
            GitHubIngestService.validate_and_parse_url(bad_url)


def test_api_connect_github_ssrf_rejection():
    """
    API endpoint must return 400 Bad Request for any invalid or SSRF URL.
    """
    res = client.post("/api/codebase/github/connect", json={
        "repo_url": "http://169.254.169.254/secret",
        "branch": "main"
    })
    assert res.status_code == 400
    assert "Invalid host" in res.json()["detail"] or "Only public repositories on 'github.com'" in res.json()["detail"]


def test_api_connect_github_safe_ingestion_and_sha_persistence():
    """
    Tests end-to-end safe GitHub ingestion with mock archive download:
    - Resolves exact commit SHA
    - Safely unpacks files without code execution
    - Produces real file paths, line numbers, and CWE findings
    - Attaches to dedicated persisted project
    """
    # Create an in-memory sample vulnerable repository ZIP
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr(
            "app/routes/users.py",
            "import os\n\ndef get_user(uid):\n    query = f\"SELECT * FROM users WHERE id = '{uid}'\"\n    return query\n"
        )
        zf.writestr("requirements.txt", "fastapi==0.100.0\nuvicorn==0.23.0\n")

    mock_archive_bytes = zip_buffer.getvalue()

    with patch("httpx.Client.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.content = mock_archive_bytes
        mock_resp.history = []
        mock_resp.json.return_value = {"sha": "9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b"}
        mock_get.return_value = mock_resp

        payload = {
            "repo_url": "https://github.com/example-org/sample-vulnerable-service",
            "branch": "main",
            "commit_sha": None,
            "project_name": "Sample-Vulnerable-Service",
            "owner_username": "security_lead"
        }

        res = client.post("/api/codebase/github/connect", json=payload)
        assert res.status_code == 200
        data = res.json()

        assert data["project_id"].startswith("proj-")
        assert data["project_name"] == "Sample-Vulnerable-Service"
        assert data["repository_url"] == "https://github.com/example-org/sample-vulnerable-service"
        assert data["branch"] == "main"
        assert data["commit_sha"] == "9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b"
        assert data["owner_username"] == "security_lead"

        # Check genuine finding details
        assert len(data["findings"]) >= 1
        finding = data["findings"][0]
        assert finding["category"] == "sql_injection"
        assert finding["cwe_id"] == "CWE-89"
        assert "users.py" in finding["file_path"]
        assert finding["line_start"] == 4
        assert "SELECT * FROM users" in finding["code_snippet"]

    # Check project scenario was pre-generated (outside httpx mock so TestClient doesn't get mocked)
    scen_res = client.get(f"/api/codebase/projects/{data['project_id']}/scenario")
    assert scen_res.status_code == 200
    scen_data = scen_res.json()
    assert len(scen_data["events"]) >= 1
