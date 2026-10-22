"""
backend/tests/test_patch_correctness.py

Regression tests for finding-to-patch correctness.

Verified bugs fixed:
- CORS finding previously received an unrelated hardcoded-secret patch (else-fallback bug).
- Verify endpoint accepted any proposed_code that lacked obvious SQL/OS patterns, including
  unrelated JWT_SECRET replacements for CORS findings.
- Patches referenced wrong file_path because diff templates were hardcoded.

These tests ensure:
1. Each category generates a patch for the CORRECT file and vulnerability class.
2. A CORS patch cannot be used to verify a SQL-injection finding (category mismatch).
3. A SQL patch cannot be used to verify a CORS finding (category mismatch).
4. Stale / cross-project finding IDs are rejected.
5. A correct CORS fix eliminates the insecure_cors pattern on rescan.
6. Failed or unrelated patches cannot transition findings to VERIFIED_FIXED.
"""
import secrets
import pytest
from fastapi.testclient import TestClient
from main import app
from app.auth.auth_service import auth_service
from app.services.project_storage import delete_project

client = TestClient(app)


@pytest.fixture
def auth_headers():
    username = f"test_patch_{secrets.token_hex(4)}"
    res = auth_service.register(username, "password123", f"{username}@test.local")
    try:
        yield {"Authorization": f"Bearer {res.token}"}
    finally:
        auth_service.delete_user(username)


@pytest.fixture
def multi_vuln_project(auth_headers):
    """Ingest the synthetic vulnerable lab and return (project_id, findings_by_rule). Cleans up project on teardown."""
    from pathlib import Path
    zip_path = Path("test-fixtures/vulnerable-lab.zip")
    assert zip_path.exists(), "Fixture zip must exist"

    with open(zip_path, "rb") as f:
        resp = client.post(
            "/api/codebase/scan/upload",
            files={"file": ("vulnerable-lab.zip", f, "application/zip")},
            data={"project_name": "PatchCorrectnessTest"},
            headers=auth_headers,
        )
    assert resp.status_code == 200, f"Upload failed: {resp.text}"
    scan = resp.json()
    proj_id = scan["project_id"]
    by_rule = {f["rule_id"]: f for f in scan["findings"]}
    try:
        yield proj_id, by_rule
    finally:
        delete_project(proj_id)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Correct category → correct file and patch content
# ─────────────────────────────────────────────────────────────────────────────

def test_cors_finding_generates_cors_patch(auth_headers, multi_vuln_project):
    """CORS finding must receive a CORS patch targeting the CORS file, not JWT_SECRET."""
    proj_id, by_rule = multi_vuln_project
    cors_finding = by_rule["RULE-SEC-005"]
    finding_id = cors_finding["id"]

    resp = client.post(
        f"/api/codebase/projects/{proj_id}/patch/generate?finding_id={finding_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200, f"Patch generation failed: {resp.text}"
    patch = resp.json()

    # Patch must reference the CORS file, not config.py
    assert "main.py" in patch["file_path"], (
        f"CORS patch must target main.py, got: {patch['file_path']}"
    )
    assert patch["category"] == "insecure_cors"

    # Proposed code must address CORS, not JWT_SECRET
    code = patch["proposed_code"]
    assert "JWT_SECRET" not in code, "CORS patch must NOT contain JWT_SECRET"
    assert "allow_origins" in code, "CORS patch must modify allow_origins"
    assert '["*"]' not in code, "CORS patch must not keep wildcard origin"
    assert "ALLOWED_ORIGINS" in code or (
        "allow_origins=[" in code and '"*"' not in code
    ), "CORS patch must restrict origins to explicit list"


def test_sql_injection_finding_generates_parameterized_patch(auth_headers, multi_vuln_project):
    """SQL injection finding must receive a parameterized-query patch."""
    proj_id, by_rule = multi_vuln_project
    sqli = by_rule["RULE-SEC-001"]

    resp = client.post(
        f"/api/codebase/projects/{proj_id}/patch/generate?finding_id={sqli['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    patch = resp.json()

    assert patch["category"] == "sql_injection"
    assert "users.py" in patch["file_path"]
    code = patch["proposed_code"]
    assert "%s" in code or "?" in code, "SQL patch must use parameterized placeholder"
    assert "JWT_SECRET" not in code


def test_hardcoded_secret_finding_generates_env_patch(auth_headers, multi_vuln_project):
    """Hardcoded secret finding must receive an os.environ patch."""
    proj_id, by_rule = multi_vuln_project
    secret_f = by_rule["RULE-SEC-003"]

    resp = client.post(
        f"/api/codebase/projects/{proj_id}/patch/generate?finding_id={secret_f['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    patch = resp.json()

    assert patch["category"] == "hardcoded_secret"
    assert "config.py" in patch["file_path"]
    code = patch["proposed_code"]
    assert "os.environ" in code or "os.getenv" in code or "environ.get" in code
    assert 'allow_origins=["*"]' not in code, "Secret patch must not touch CORS config"


def test_command_injection_finding_generates_subprocess_patch(auth_headers, multi_vuln_project):
    """Command injection finding must use subprocess.run with shell=False."""
    proj_id, by_rule = multi_vuln_project
    cmd_f = by_rule["RULE-SEC-002"]

    resp = client.post(
        f"/api/codebase/projects/{proj_id}/patch/generate?finding_id={cmd_f['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    patch = resp.json()

    assert patch["category"] == "command_injection"
    assert "backup.py" in patch["file_path"]
    code = patch["proposed_code"]
    assert "subprocess" in code and "shell=False" in code
    assert "os.system" not in code


def test_path_traversal_finding_generates_sanitization_patch(auth_headers, multi_vuln_project):
    """Path traversal finding must receive a path-sanitization patch."""
    proj_id, by_rule = multi_vuln_project
    pt_f = by_rule["RULE-SEC-004"]

    resp = client.post(
        f"/api/codebase/projects/{proj_id}/patch/generate?finding_id={pt_f['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    patch = resp.json()

    assert patch["category"] == "path_traversal"
    assert "files.py" in patch["file_path"]
    code = patch["proposed_code"]
    assert "resolve()" in code or "basename" in code or "startswith" in code


# ─────────────────────────────────────────────────────────────────────────────
# 2. Cross-category patch rejection
# ─────────────────────────────────────────────────────────────────────────────

def test_cors_patch_code_rejected_for_sql_finding(auth_headers, multi_vuln_project):
    """A CORS patch proposed_code must be rejected when verifying a SQL-injection finding."""
    proj_id, by_rule = multi_vuln_project
    sqli_id = by_rule["RULE-SEC-001"]["id"]

    # Generate the correct CORS patch code
    cors_id = by_rule["RULE-SEC-005"]["id"]
    cors_resp = client.post(
        f"/api/codebase/projects/{proj_id}/patch/generate?finding_id={cors_id}",
        headers=auth_headers,
    )
    cors_code = cors_resp.json()["proposed_code"]

    # Now try to verify the SQL finding with CORS proposed code
    verify_resp = client.post(
        f"/api/codebase/projects/{proj_id}/patch/verify",
        json={"finding_id": sqli_id, "proposed_code": cors_code},
        headers=auth_headers,
    )
    assert verify_resp.status_code == 200
    result = verify_resp.json()
    # CORS code does not contain parameterized placeholders → coherence check fails
    assert result["verification_status"] == "VERIFICATION_FAILED"
    assert result["verified"] is False


def test_jwt_secret_patch_code_rejected_for_cors_finding(auth_headers, multi_vuln_project):
    """The old JWT_SECRET patch must be rejected when applied to a CORS finding."""
    proj_id, by_rule = multi_vuln_project
    cors_id = by_rule["RULE-SEC-005"]["id"]

    # Mimic the old buggy patch: JWT_SECRET replacement code
    bad_code = (
        "JWT_SECRET = os.environ.get('JWT_SECRET')\n"
        "if not JWT_SECRET:\n"
        "    raise RuntimeError('JWT_SECRET environment variable is missing!')"
    )

    verify_resp = client.post(
        f"/api/codebase/projects/{proj_id}/patch/verify",
        json={"finding_id": cors_id, "proposed_code": bad_code},
        headers=auth_headers,
    )
    assert verify_resp.status_code == 200
    result = verify_resp.json()
    # CORS coherence check requires allow_origins change; JWT code lacks it
    assert result["verification_status"] == "VERIFICATION_FAILED"
    assert result["verified"] is False


def test_sql_patch_rejected_for_cors_finding(auth_headers, multi_vuln_project):
    """A SQL parameterized-query patch must be rejected for a CORS finding."""
    proj_id, by_rule = multi_vuln_project
    cors_id = by_rule["RULE-SEC-005"]["id"]

    sql_code = (
        'query = "SELECT * FROM users WHERE username = %s"\n'
        "cursor.execute(query, (search_query,))\n"
        "results = cursor.fetchall()"
    )

    verify_resp = client.post(
        f"/api/codebase/projects/{proj_id}/patch/verify",
        json={"finding_id": cors_id, "proposed_code": sql_code},
        headers=auth_headers,
    )
    assert verify_resp.status_code == 200
    result = verify_resp.json()
    assert result["verification_status"] == "VERIFICATION_FAILED"
    assert result["verified"] is False


# ─────────────────────────────────────────────────────────────────────────────
# 3. Stale / cross-project finding ID rejection
# ─────────────────────────────────────────────────────────────────────────────

def test_nonexistent_finding_id_rejected_in_patch_generate(auth_headers, multi_vuln_project):
    """A finding ID that does not belong to this project must return 404."""
    proj_id, _ = multi_vuln_project

    resp = client.post(
        f"/api/codebase/projects/{proj_id}/patch/generate?finding_id=VULN-DEADBEEF",
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_nonexistent_finding_id_rejected_in_patch_verify(auth_headers, multi_vuln_project):
    """A stale finding ID that does not exist in this project must return 404 on verify."""
    proj_id, _ = multi_vuln_project

    resp = client.post(
        f"/api/codebase/projects/{proj_id}/patch/verify",
        json={"finding_id": "VULN-DEADBEEF", "proposed_code": "allow_origins=['http://localhost:5173']"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_cross_project_finding_id_rejected(auth_headers, multi_vuln_project):
    """Finding IDs from project A must not be usable against project B."""
    proj_a_id, by_rule_a = multi_vuln_project

    # Ingest a second project
    from pathlib import Path
    zip_path = Path("test-fixtures/vulnerable-lab.zip")
    with open(zip_path, "rb") as f:
        resp_b = client.post(
            "/api/codebase/scan/upload",
            files={"file": ("vulnerable-lab.zip", f, "application/zip")},
            data={"project_name": "PatchIsolationProjectB"},
            headers=auth_headers,
        )
    assert resp_b.status_code == 200
    proj_b_id = resp_b.json()["project_id"]

    try:
        # Use project A's finding ID against project B
        finding_from_a = by_rule_a["RULE-SEC-005"]["id"]
        resp = client.post(
            f"/api/codebase/projects/{proj_b_id}/patch/generate?finding_id={finding_from_a}",
            headers=auth_headers,
        )
        # The finding ID belongs to project A; project B has different IDs → 404
        assert resp.status_code == 404, (
            f"Cross-project finding ID must be rejected with 404, got {resp.status_code}: {resp.text}"
        )
    finally:
        delete_project(proj_b_id)


# ─────────────────────────────────────────────────────────────────────────────
# 4. Wildcard CORS patch rejected at verify (vulnerable pattern guard)
# ─────────────────────────────────────────────────────────────────────────────

def test_wildcard_cors_not_accepted_as_fix(auth_headers, multi_vuln_project):
    """Proposed code that still contains allow_origins=[\"*\"] must be rejected."""
    proj_id, by_rule = multi_vuln_project
    cors_id = by_rule["RULE-SEC-005"]["id"]

    bad_code = (
        'app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,'
        ' allow_methods=["*"], allow_headers=["*"])'
    )

    resp = client.post(
        f"/api/codebase/projects/{proj_id}/patch/verify",
        json={"finding_id": cors_id, "proposed_code": bad_code},
        headers=auth_headers,
    )
    result = resp.json()
    assert result["verification_status"] == "VERIFICATION_FAILED"
    assert result["verified"] is False


# ─────────────────────────────────────────────────────────────────────────────
# 5. Correct CORS fix passes verification
# ─────────────────────────────────────────────────────────────────────────────

def test_correct_cors_fix_passes_verification(auth_headers, multi_vuln_project):
    """A correct CORS remediation (explicit origins) must pass verification."""
    proj_id, by_rule = multi_vuln_project
    cors_id = by_rule["RULE-SEC-005"]["id"]

    # Generate the canonical patch first
    gen_resp = client.post(
        f"/api/codebase/projects/{proj_id}/patch/generate?finding_id={cors_id}",
        headers=auth_headers,
    )
    assert gen_resp.status_code == 200
    patch = gen_resp.json()

    # Verify with the canonical proposed code
    verify_resp = client.post(
        f"/api/codebase/projects/{proj_id}/patch/verify",
        json={"finding_id": cors_id, "proposed_code": patch["proposed_code"]},
        headers=auth_headers,
    )
    assert verify_resp.status_code == 200
    result = verify_resp.json()
    assert result["verification_status"] == "VERIFIED_FIXED"
    assert result["verified"] is True
    assert result["attack_path_severed"] is True


# ─────────────────────────────────────────────────────────────────────────────
# 7. Patch targeting wrong file is rejected
# ─────────────────────────────────────────────────────────────────────────────

def test_patch_targeting_wrong_file_rejected(auth_headers, multi_vuln_project):
    """A patch specifying a target_file that does not match the finding's file must be rejected."""
    proj_id, by_rule = multi_vuln_project
    cors_id = by_rule["RULE-SEC-005"]["id"]

    # Generate valid CORS proposed code
    gen_resp = client.post(
        f"/api/codebase/projects/{proj_id}/patch/generate?finding_id={cors_id}",
        headers=auth_headers,
    )
    cors_code = gen_resp.json()["proposed_code"]

    # Attempt verification targeting users.py instead of main.py
    verify_resp = client.post(
        f"/api/codebase/projects/{proj_id}/patch/verify",
        json={
            "finding_id": cors_id,
            "proposed_code": cors_code,
            "target_file": "backend/api/users.py",
        },
        headers=auth_headers,
    )
    assert verify_resp.status_code == 200
    result = verify_resp.json()
    assert result["verification_status"] == "VERIFICATION_FAILED"
    assert result["verified"] is False
    assert "does not match finding's file" in result["message"]


# ─────────────────────────────────────────────────────────────────────────────
# 8. Failed or rejected patch leaves source file byte-for-byte unchanged
# ─────────────────────────────────────────────────────────────────────────────

def test_failed_patch_leaves_source_file_byte_for_byte_unchanged(auth_headers, multi_vuln_project):
    """When a patch fails validation or coherence checks, the on-disk file must remain byte-for-byte identical."""
    from app.services.project_storage import get_source_file_content

    proj_id, by_rule = multi_vuln_project
    cors_finding = by_rule["RULE-SEC-005"]
    cors_id = cors_finding["id"]
    cors_fp = cors_finding["file_path"]

    # Read original content byte-for-byte
    original_content = get_source_file_content(proj_id, cors_fp)
    assert original_content is not None
    assert len(original_content) > 0

    # Attempt to apply an unrelated / invalid JWT secret patch
    bad_code = "JWT_SECRET = 'invalid_overwrite_attempt_12345'\n"
    verify_resp = client.post(
        f"/api/codebase/projects/{proj_id}/patch/verify",
        json={"finding_id": cors_id, "proposed_code": bad_code},
        headers=auth_headers,
    )
    result = verify_resp.json()
    assert result["verification_status"] == "VERIFICATION_FAILED"
    assert result["verified"] is False

    # Verify disk content has NOT changed by even a single byte
    post_content = get_source_file_content(proj_id, cors_fp)
    assert post_content == original_content, (
        "CRITICAL DEFECT: File content was modified despite patch verification failure!"
    )


# ─────────────────────────────────────────────────────────────────────────────
# 9. Correct CORS fix removes targeted finding on scanner re-scan
# ─────────────────────────────────────────────────────────────────────────────

def test_correct_cors_fix_eliminates_finding_on_rescan(auth_headers, multi_vuln_project):
    """Applying a verified CORS fix writes the clean code and a directory rescan no longer finds CORS vulnerability."""
    from app.services.project_storage import _source_dir
    from app.analysis.code_scanner import CodeScannerService

    proj_id, by_rule = multi_vuln_project
    cors_id = by_rule["RULE-SEC-005"]["id"]

    # Confirm CORS finding exists before fix
    scanner = CodeScannerService()
    src_dir = str(_source_dir(proj_id))
    pre_scan = scanner.scan_directory(src_dir)
    cors_pre = [f for f in pre_scan if f.rule_id == "RULE-SEC-005"]
    assert len(cors_pre) == 1, "Expected exactly 1 CORS finding before fix"

    # Generate and apply valid fix
    gen_resp = client.post(
        f"/api/codebase/projects/{proj_id}/patch/generate?finding_id={cors_id}",
        headers=auth_headers,
    )
    patch_code = gen_resp.json()["proposed_code"]

    verify_resp = client.post(
        f"/api/codebase/projects/{proj_id}/patch/verify",
        json={"finding_id": cors_id, "proposed_code": patch_code},
        headers=auth_headers,
    )
    assert verify_resp.json()["verification_status"] == "VERIFIED_FIXED"

    # Re-scan source directory on disk
    post_scan = scanner.scan_directory(src_dir)
    cors_post = [f for f in post_scan if f.rule_id == "RULE-SEC-005"]
    assert len(cors_post) == 0, (
        f"Expected 0 CORS findings after fix, but scanner found: {cors_post}"
    )
