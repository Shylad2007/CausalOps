# Vulnerable Lab — Synthetic Security Test Application

> **DEFENSIVE TESTING USE ONLY**  
> This directory is a synthetic test fixture created strictly for local validation of CausalOps security analysis.  
> It must never be deployed, exposed to the network, or used in production.

---

## Documented Ground Truth Vulnerabilities

| File Path | Line | Rule ID | Vulnerability Category | Severity | CWE | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `backend/api/users.py` | Line 16 | `RULE-SEC-001` | `sql_injection` | `CRITICAL` | CWE-89 | Raw SQL f-string concatenation in user query. |
| `backend/services/backup.py` | Line 14 | `RULE-SEC-002` | `command_injection` | `CRITICAL` | CWE-78 | User-controlled command string passed to `os.system()`. |
| `backend/core/config.py` | Line 8 | `RULE-SEC-003` | `hardcoded_secret` | `HIGH` | CWE-798 | Hardcoded JWT secret key directly in application source. |
| `backend/api/files.py` | Line 12 | `RULE-SEC-004` | `path_traversal` | `HIGH` | CWE-22 | Unsanitized file path parameter in `open()`. |
| `backend/main.py` | Line 15 | `RULE-SEC-005` | `insecure_cors` | `MEDIUM` | CWE-942 | Wildcard CORS origin `allow_origins = ["*"]`. |

---

## Expected Remediation

1. **SQL Injection**: Replace `f"SELECT ..."` with parameterized query `cursor.execute("SELECT ... WHERE username = ?", (username,))`.
2. **Command Injection**: Replace `os.system()` with `subprocess.run(["tar", "-czf", output_path, target_dir], shell=False)`.
3. **Hardcoded Secret**: Load secret from environment via `os.getenv("JWT_SECRET")`.
4. **Path Traversal**: Validate and resolve paths against an authorized base directory using `Path.resolve()` and verify it starts with the root.
5. **Insecure CORS**: Restrict `allow_origins` to explicitly trusted frontend domains (e.g. `["http://localhost:5173"]`).
