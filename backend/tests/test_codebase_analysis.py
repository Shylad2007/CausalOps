import io
import zipfile
import pytest
from fastapi.testclient import TestClient
from main import app
from app.analysis.repo_ingest import RepoIngestService
from app.analysis.code_scanner import CodeScannerService
from app.services.project_storage import delete_project

client = TestClient(app)

def create_mock_zip(files_dict: dict) -> bytes:
    """Helper creating in-memory ZIP archive."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as z:
        for path, content in files_dict.items():
            z.writestr(path, content)
    buffer.seek(0)
    return buffer.getvalue()

def test_zip_slip_prevention(tmp_path):
    """
    Verifies that safe extraction catches and prevents Zip-Slip directory traversal attempts.
    """
    ingest = RepoIngestService()
    # Craft a malicious archive entry with '../'
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as z:
        z.writestr("../../etc/passwd", "root:x:0:0:")
    buffer.seek(0)

    with pytest.raises(ValueError, match="path traversal"):
        ingest.extract_zip(buffer.getvalue(), str(tmp_path))

def test_code_scanner_detects_real_vulnerabilities(tmp_path):
    """
    Verifies that deterministic scanner detects SQL injection and command injection
    with exact file paths and line numbers.
    """
    code_file = tmp_path / "app.py"
    code_file.write_text(
        '# vulnerable code\n'
        'import os\n'
        'def run_query(user_val):\n'
        '    cursor.execute(f"SELECT * FROM items WHERE id = {user_val}")\n'
        'def exec_ping(host):\n'
        '    os.system(f"ping {host}")\n',
        encoding="utf-8"
    )

    scanner = CodeScannerService()
    findings = scanner.scan_directory(str(tmp_path))

    assert len(findings) >= 2
    categories = {f.category.value for f in findings}
    assert "sql_injection" in categories
    assert "command_injection" in categories

    sql_finding = next(f for f in findings if f.category.value == "sql_injection")
    assert sql_finding.line_start == 4
    assert "SELECT * FROM items" in sql_finding.code_snippet

def test_api_upload_and_scan_zip():
    """
    End-to-end integration test: Upload a ZIP codebase via API,
    verify manifest detection and findings generation.
    """
    files = {
        "requirements.txt": "fastapi==0.115.0\nuvicorn==0.32.0\n",
        "routes/search.py": (
            "from fastapi import APIRouter\n"
            "router = APIRouter()\n"
            "@router.get('/search')\n"
            "def search(q: str):\n"
            "    cursor.execute(f'SELECT * FROM products WHERE name = {q}')\n"
        ),
        "core/config.py": (
            "JWT_SECRET = 'secret_production_key_1234567890'\n"
        )
    }
    zip_bytes = create_mock_zip(files)

    response = client.post(
        "/api/codebase/scan/upload",
        files={"file": ("test_project.zip", zip_bytes, "application/zip")},
        data={"project_name": "Test-Ecom-Service"}
    )
    assert response.status_code == 200
    data = response.json()

    try:
        assert data["project_name"] == "Test-Ecom-Service"
        assert "Python" in data["manifest"]["detected_languages"]
        assert "FastAPI" in data["manifest"]["detected_frameworks"]
        assert data["total_findings"] >= 2
        assert any(f["category"] == "sql_injection" for f in data["findings"])
        assert any(f["category"] == "hardcoded_secret" for f in data["findings"])
    finally:
        delete_project(data["project_id"])

def test_demo_codebase_endpoint():
    """
    Verifies that the demo codebase endpoint returns complete project findings.
    """
    response = client.get("/api/codebase/demo")
    assert response.status_code == 200
    data = response.json()
    assert data["project_id"] == "proj-demo-shoppulse"
    assert len(data["findings"]) == 3
    assert data["critical_count"] == 2

def test_codebase_attack_graph_endpoint():
    """
    Verifies that the attack graph endpoint generates an architectural DAG
    connecting entrypoints to gateways, vulnerable handlers, and sinks.
    """
    response = client.get("/api/codebase/projects/proj-demo-shoppulse/graph")
    assert response.status_code == 200
    graph = response.json()
    assert graph["project_id"] == "proj-demo-shoppulse"
    assert len(graph["nodes"]) >= 4
    assert len(graph["edges"]) >= 3
    
    node_ids = {n["id"] for n in graph["nodes"]}
    assert "node-attacker-client" in node_ids
    assert "node-api-router" in node_ids
    assert any(n["category"] == "vulnerable_component" for n in graph["nodes"])
    assert any(n["category"] == "compromised_sink" for n in graph["nodes"])

def test_patch_generation_and_verification():
    """
    Verifies that remediation patch generation provides valid diffs and explanations,
    and sandbox verification confirms fix resolution.
    """
    # 1. Generate patch for SQL injection finding VULN-001
    gen_res = client.post("/api/codebase/projects/proj-demo-shoppulse/patch/generate?finding_id=VULN-001")
    assert gen_res.status_code == 200
    patch = gen_res.json()
    assert patch["finding_id"] == "VULN-001"
    assert "proposed_code" in patch
    assert "diff" in patch
    assert patch["verification_status"] == "PENDING_APPROVAL"

    # 2. Verify with good proposed code -> VERIFIED_FIXED
    ver_res = client.post(
        "/api/codebase/projects/proj-demo-shoppulse/patch/verify",
        json={"finding_id": "VULN-001", "proposed_code": patch["proposed_code"]}
    )
    assert ver_res.status_code == 200
    ver_data = ver_res.json()
    assert ver_data["verified"] is True
    assert ver_data["verification_status"] == "VERIFIED_FIXED"
    assert ver_data["attack_path_severed"] is True

    # 3. Verify with still-vulnerable code -> VERIFICATION_FAILED
    bad_res = client.post(
        "/api/codebase/projects/proj-demo-shoppulse/patch/verify",
        json={"finding_id": "VULN-001", "proposed_code": "cursor.execute(f'SELECT * FROM users WHERE {bad}')"}
    )
    assert bad_res.status_code == 200
    bad_data = bad_res.json()
    assert bad_data["verified"] is False
    assert bad_data["verification_status"] == "VERIFICATION_FAILED"
