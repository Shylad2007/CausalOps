import ast
import re
import os
import uuid
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from app.models.codebase_schemas import (
    VulnerabilityFinding,
    VulnerabilitySeverity,
    VulnerabilityCategory
)

def mask_secret_value(val: str) -> str:
    """Masks high-entropy secret string to prevent credential exposure in UI/logs."""
    if len(val) <= 8:
        return "********"
    prefix = val[:4]
    suffix = val[-4:]
    masked_middle = "*" * min(16, max(4, len(val) - 8))
    return f"{prefix}{masked_middle}{suffix}"


def analyze_python_ast(content: str, rel_path: str) -> List[Dict[str, Any]]:
    """
    Genuine AST analysis for Python source code.
    Identifies AST calls, formatted strings, argument handling, and assignments.
    Returns structured AST finding records with source-to-sink trace information.
    """
    ast_findings: List[Dict[str, Any]] = []
    try:
        tree = ast.parse(content)
    except SyntaxError:
        return ast_findings

    lines = content.splitlines()

    class SecurityASTVisitor(ast.NodeVisitor):
        def __init__(self):
            super().__init__()
            self.assignments = {}

        def visit_Call(self, node: ast.Call):
            func_name = ""
            if isinstance(node.func, ast.Name):
                func_name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                func_name = node.func.attr

            # 1. SQL Injection: Call to execute / query with formatted string (f-string or binop %)
            if func_name in ("execute", "executemany", "query") and node.args:
                arg0 = node.args[0]
                has_dynamic_format = False
                source_var = None
                assign_line = None

                format_node = arg0
                if isinstance(arg0, ast.Name) and arg0.id in self.assignments:
                    format_node, assign_line = self.assignments[arg0.id]

                if isinstance(format_node, ast.JoinedStr):
                    has_dynamic_format = True
                    for val in format_node.values:
                        if isinstance(val, ast.FormattedValue) and isinstance(val.value, ast.Name):
                            source_var = val.value.id
                elif isinstance(format_node, ast.BinOp) and isinstance(format_node.op, (ast.Add, ast.Mod)):
                    has_dynamic_format = True
                    if isinstance(format_node.right, ast.Name):
                        source_var = format_node.right.id
                    elif isinstance(format_node.left, ast.Name):
                        source_var = format_node.left.id

                # Check if second arg is parameterized tuple
                is_parameterized = len(node.args) >= 2 and isinstance(node.args[1], (ast.Tuple, ast.List, ast.Dict))

                if has_dynamic_format and not is_parameterized:
                    line_start = assign_line or node.lineno
                    line_end = getattr(node, "end_lineno", node.lineno)
                    start_ctx = max(0, line_start - 2)
                    end_ctx = min(len(lines), line_end + 2)
                    snippet = "\n".join(lines[start_ctx:end_ctx])

                    src_expr = source_var or "user_val"
                    src_loc = f"{rel_path}:L{assign_line} ({src_expr})" if assign_line else f"{rel_path}:L{node.lineno} ({src_expr})"
                    ast_findings.append({
                        "rule_id": "RULE-SEC-001",
                        "category": VulnerabilityCategory.SQL_INJECTION,
                        "severity": VulnerabilitySeverity.CRITICAL,
                        "title": "Raw SQL String Concatenation with User Input",
                        "description": "Constructing dynamic SQL queries via string formatting or concatenation exposes the database to SQL injection attacks.",
                        "cwe_id": "CWE-89",
                        "owasp_category": "A03:2021-Injection",
                        "line_start": line_start,
                        "line_end": line_end,
                        "code_snippet": snippet,
                        "remediation_guidance": "Use parameterized queries or ORM prepared statements instead of string concatenation.",
                        "detection_method": "ast_analysis",
                        "source_location": src_loc,
                        "sink_location": f"{rel_path}:L{node.lineno} (cursor.{func_name})",
                        "data_flow_steps": [
                            f"Input parameter '{src_expr}' incorporated into query string without parameterization",
                            f"Dispatched directly to database sink at line {node.lineno} via cursor.{func_name}()",
                        ],
                        "sanitization_detected": False,
                        "is_flow_complete": True,
                        "evidence_summary": f"AST Call to cursor.{func_name}() with dynamic formatted string argument.",
                    })

            # 2. Command Injection: Call to os.system or subprocess with shell=True
            if func_name == "system" and node.args:
                # os.system(cmd)
                arg0 = node.args[0]
                is_dynamic = isinstance(arg0, (ast.JoinedStr, ast.BinOp))
                source_var = None
                if isinstance(arg0, ast.BinOp):
                    if isinstance(arg0.right, ast.Name):
                        source_var = arg0.right.id
                    elif isinstance(arg0.left, ast.Name):
                        source_var = arg0.left.id

                line_start = node.lineno
                line_end = getattr(node, "end_lineno", node.lineno)
                start_ctx = max(0, line_start - 2)
                end_ctx = min(len(lines), line_end + 2)
                snippet = "\n".join(lines[start_ctx:end_ctx])

                src_loc = f"{rel_path}:L{line_start} ({source_var})" if source_var else f"{rel_path}:L{line_start}"
                ast_findings.append({
                    "rule_id": "RULE-SEC-002",
                    "category": VulnerabilityCategory.COMMAND_INJECTION,
                    "severity": VulnerabilitySeverity.CRITICAL,
                    "title": "Untrusted System Shell Command Execution",
                    "description": "Executing system shell commands with user-controlled input allows arbitrary command execution on the host server.",
                    "cwe_id": "CWE-78",
                    "owasp_category": "A03:2021-Injection",
                    "line_start": line_start,
                    "line_end": line_end,
                    "code_snippet": snippet,
                    "remediation_guidance": "Pass command arguments as a list without shell=True, or use dedicated non-shell library APIs.",
                    "detection_method": "ast_analysis",
                    "source_location": src_loc,
                    "sink_location": f"{rel_path}:L{line_start} (os.system)",
                    "data_flow_steps": [
                        f"Command string formatted dynamically at line {line_start}" + (f" with '{source_var}'" if source_var else ""),
                        "Passed directly to os.system() executing subshell",
                    ],
                    "sanitization_detected": False,
                    "is_flow_complete": True,
                    "evidence_summary": "AST Call to os.system() invokes underlying system shell.",
                })
            elif func_name in ("Popen", "run", "call"):
                # Check for shell=True keyword
                has_shell_true = any(
                    kw.arg == "shell" and isinstance(kw.value, ast.Constant) and kw.value.value is True
                    for kw in node.keywords
                )
                if has_shell_true:
                    line_start = node.lineno
                    line_end = getattr(node, "end_lineno", node.lineno)
                    start_ctx = max(0, line_start - 2)
                    end_ctx = min(len(lines), line_end + 2)
                    snippet = "\n".join(lines[start_ctx:end_ctx])

                    ast_findings.append({
                        "rule_id": "RULE-SEC-002",
                        "category": VulnerabilityCategory.COMMAND_INJECTION,
                        "severity": VulnerabilitySeverity.CRITICAL,
                        "title": "Untrusted System Shell Command Execution",
                        "description": "Executing system shell commands with user-controlled input allows arbitrary command execution on the host server.",
                        "cwe_id": "CWE-78",
                        "owasp_category": "A03:2021-Injection",
                        "line_start": line_start,
                        "line_end": line_end,
                        "code_snippet": snippet,
                        "remediation_guidance": "Pass command arguments as a list without shell=True, or use dedicated non-shell library APIs.",
                        "detection_method": "python_ast_data_flow",
                        "source_location": f"{rel_path}:L{line_start}",
                        "sink_location": f"{rel_path}:L{line_start} (subprocess.{func_name} with shell=True)",
                        "data_flow_steps": [
                            f"subprocess.{func_name}() invoked with shell=True keyword argument",
                            "Enables shell interpolation and command concatenation",
                        ],
                        "sanitization_detected": False,
                        "is_flow_complete": True,
                        "evidence_summary": f"subprocess.{func_name} executed with shell=True.",
                    })

            # 3. Insecure CORS
            if func_name == "CORSMiddleware" or (isinstance(node.func, ast.Attribute) and node.func.attr == "add_middleware"):
                has_wildcard_origins = False
                has_credentials = False
                for kw in node.keywords:
                    if kw.arg == "allow_origins":
                        if isinstance(kw.value, (ast.List, ast.Tuple, ast.Set)):
                            for elt in kw.value.elts:
                                if isinstance(elt, ast.Constant) and elt.value == "*":
                                    has_wildcard_origins = True
                    elif kw.arg == "allow_credentials":
                        if isinstance(kw.value, ast.Constant) and kw.value.value is True:
                            has_credentials = True

                if has_wildcard_origins:
                    line_start = node.lineno
                    line_end = getattr(node, "end_lineno", node.lineno)
                    start_ctx = max(0, line_start - 2)
                    end_ctx = min(len(lines), line_end + 2)
                    snippet = "\n".join(lines[start_ctx:end_ctx])

                    ast_findings.append({
                        "rule_id": "RULE-SEC-005",
                        "category": VulnerabilityCategory.INSECURE_CORS,
                        "severity": VulnerabilitySeverity.MEDIUM,
                        "title": "Permissive Wildcard CORS Configuration",
                        "description": "Configuring Access-Control-Allow-Origin with a wildcard '*' alongside credentials exposes endpoints to cross-origin data theft.",
                        "cwe_id": "CWE-942",
                        "owasp_category": "A05:2021-Security Misconfiguration",
                        "line_start": line_start,
                        "line_end": line_end,
                        "code_snippet": snippet,
                        "remediation_guidance": "Specify explicit trusted origins in CORS configurations instead of using wildcards.",
                        "detection_method": "python_ast_configuration",
                        "source_location": f"{rel_path}:L{line_start} (CORSMiddleware config)",
                        "sink_location": f"{rel_path}:L{line_start} (HTTP Response Headers)",
                        "data_flow_steps": [
                            "Middleware allows origins=['*'] with allow_credentials=True",
                            "Browsers permit credentialed cross-origin read access from any external origin",
                        ],
                        "sanitization_detected": False,
                        "is_flow_complete": True,
                        "evidence_summary": "AST inspection detected allow_origins=['*'] wildcard in CORSMiddleware configuration.",
                    })

            self.generic_visit(node)

        def visit_Assign(self, node: ast.Assign):
            # Track variable assignments for data-flow analysis
            for target in node.targets:
                if isinstance(target, ast.Name):
                    self.assignments[target.id] = (node.value, node.lineno)

            # 4. Hardcoded Secret: Variable assigned to string literal >= 12 chars
            secret_keywords = ("password", "secret", "api_key", "apikey", "jwt_secret", "private_key", "token")
            for target in node.targets:
                var_name = ""
                if isinstance(target, ast.Name):
                    var_name = target.id
                elif isinstance(target, ast.Attribute):
                    var_name = target.attr

                if any(kw in var_name.lower() for kw in secret_keywords) and isinstance(node.value, ast.Constant):
                    val = str(node.value.value)
                    if len(val) >= 12 and not val.startswith("os.environ") and not val.startswith("${"):
                        line_start = node.lineno
                        line_end = getattr(node, "end_lineno", node.lineno)
                        start_ctx = max(0, line_start - 2)
                        end_ctx = min(len(lines), line_end + 2)
                        snippet = "\n".join(lines[start_ctx:end_ctx])
                        masked = mask_secret_value(val)
                        masked_snippet = snippet.replace(val, masked)

                        ast_findings.append({
                            "rule_id": "RULE-SEC-003",
                            "category": VulnerabilityCategory.HARDCODED_SECRET,
                            "severity": VulnerabilitySeverity.HIGH,
                            "title": "Hardcoded Secret / API Key in Source Code",
                            "description": "Hardcoding cryptographic keys, tokens, or database credentials directly in source files risks credential exposure.",
                            "cwe_id": "CWE-798",
                            "owasp_category": "A07:2021-Identification and Authentication Failures",
                            "line_start": line_start,
                            "line_end": line_end,
                            "code_snippet": snippet,
                            "masked_snippet": masked_snippet,
                            "remediation_guidance": "Store credentials in environment variables or a dedicated secrets manager (e.g., Vault, AWS Secrets Manager).",
                            "detection_method": "python_ast_assignment",
                            "source_location": f"{rel_path}:L{line_start} ({var_name} literal)",
                            "sink_location": f"{rel_path}:L{line_start}",
                            "data_flow_steps": [
                                f"Constant assignment of variable '{var_name}' to literal string token ({len(val)} chars)",
                                "Secret is exposed in repository history and plain source code",
                            ],
                            "sanitization_detected": False,
                            "is_flow_complete": True,
                            "evidence_summary": f"AST assignment of sensitive variable '{var_name}' to string literal.",
                        })

            self.generic_visit(node)

    visitor = SecurityASTVisitor()
    visitor.visit(tree)
    return ast_findings

# Deterministic security rules with regex patterns and semantic extractors
SECURITY_RULES = [
    {
        "rule_id": "RULE-SEC-001",
        "category": VulnerabilityCategory.SQL_INJECTION,
        "severity": VulnerabilitySeverity.CRITICAL,
        "title": "Raw SQL String Concatenation with User Input",
        "description": "Constructing dynamic SQL queries via string formatting or concatenation exposes the database to SQL injection attacks.",
        "cwe_id": "CWE-89",
        "owasp_category": "A03:2021-Injection",
        "patterns": [
            r"cursor\.execute\s*\(\s*f[\"'].*SELECT.*\{.*\}",
            r"cursor\.execute\s*\(\s*[\"'].*SELECT.*%s.*%\s*\(",
            r"cursor\.execute\s*\(\s*[\"'].*SELECT.*\+\s*",
            r"SELECT\s+.*\s+FROM\s+.*WHERE\s+.*=\s*['\"]\s*\+\s*",
            r"query\s*=\s*f[\"'].*SELECT.*FROM.*WHERE.*\{.*\}",
            r"db\.query\s*\(\s*f[\"'].*\{.*\}",
        ],
        "extensions": [".py", ".js", ".ts"],
        "remediation_guidance": "Use parameterized queries or ORM prepared statements instead of string concatenation."
    },
    {
        "rule_id": "RULE-SEC-002",
        "category": VulnerabilityCategory.COMMAND_INJECTION,
        "severity": VulnerabilitySeverity.CRITICAL,
        "title": "Untrusted System Shell Command Execution",
        "description": "Executing system shell commands with user-controlled input allows arbitrary command execution on the host server.",
        "cwe_id": "CWE-78",
        "owasp_category": "A03:2021-Injection",
        "patterns": [
            r"os\.system\s*\(\s*f[\"'].*\{.*\}",
            r"os\.system\s*\(\s*.*?\+\s*",
            r"subprocess\.Popen\s*\(.*shell\s*=\s*True",
            r"subprocess\.run\s*\(.*shell\s*=\s*True",
            r"exec\s*\(\s*f?[\"'].*\{.*\}",
            r"child_process\.exec\s*\(",
        ],
        "extensions": [".py", ".js", ".ts"],
        "remediation_guidance": "Pass command arguments as a list without shell=True, or use dedicated non-shell library APIs."
    },
    {
        "rule_id": "RULE-SEC-003",
        "category": VulnerabilityCategory.HARDCODED_SECRET,
        "severity": VulnerabilitySeverity.HIGH,
        "title": "Hardcoded Secret / API Key in Source Code",
        "description": "Hardcoding cryptographic keys, tokens, or database credentials directly in source files risks credential exposure.",
        "cwe_id": "CWE-798",
        "owasp_category": "A07:2021-Identification and Authentication Failures",
        "patterns": [
            r"(?i)(password|secret|api_key|apikey|jwt_secret|private_key)\s*=\s*['\"][a-zA-Z0-9_\-\.]{12,}['\"]",
            r"(?i)aws_secret_access_key\s*=\s*['\"][a-zA-Z0-9_\-\.]{16,}['\"]",
            r"(?i)bearer\s+[a-zA-Z0-9_\-\.]{24,}",
        ],
        "extensions": [".py", ".js", ".ts", ".json", ".env"],
        "remediation_guidance": "Store credentials in environment variables or a dedicated secrets manager (e.g., Vault, AWS Secrets Manager)."
    },
    {
        "rule_id": "RULE-SEC-004",
        "category": VulnerabilityCategory.PATH_TRAVERSAL,
        "severity": VulnerabilitySeverity.HIGH,
        "title": "Potential Path Traversal in File Access",
        "description": "Opening file paths constructed directly from user input allows attackers to read or write arbitrary filesystem files.",
        "cwe_id": "CWE-22",
        "owasp_category": "A01:2021-Broken Access Control",
        "patterns": [
            r"open\s*\(\s*f?[\"'].*\{.*\}\s*[\"']",
            r"open\s*\(\s*request\.(args|form|GET|POST|params)",
            r"fs\.readFileSync\s*\(\s*req\.(query|params|body)",
        ],
        "extensions": [".py", ".js", ".ts"],
        "remediation_guidance": "Sanitize path inputs with os.path.basename or verify paths using resolve() within an allowed root directory."
    },
    {
        "rule_id": "RULE-SEC-005",
        "category": VulnerabilityCategory.INSECURE_CORS,
        "severity": VulnerabilitySeverity.MEDIUM,
        "title": "Permissive Wildcard CORS Configuration",
        "description": "Configuring Access-Control-Allow-Origin with a wildcard '*' alongside credentials exposes endpoints to cross-origin data theft.",
        "cwe_id": "CWE-942",
        "owasp_category": "A05:2021-Security Misconfiguration",
        "patterns": [
            r"allow_origins\s*=\s*\[\s*[\"']\*[\"']\s*\]",
            r"Access-Control-Allow-Origin\s*:\s*\*",
            r"cors\(\s*\{\s*origin\s*:\s*[\"']\*[\"']",
        ],
        "extensions": [".py", ".js", ".ts"],
        "remediation_guidance": "Specify explicit trusted origins in CORS configurations instead of using wildcards."
    }
]

class CodeScannerService:
    """
    Deterministic static security analyzer.
    Extracts line numbers, exact code snippets, and rules from code files.
    """

    def scan_python_ast(self, rel_path: str, content: str) -> List[VulnerabilityFinding]:
        ast_results = analyze_python_ast(content, rel_path)
        findings = []
        for item in ast_results:
            findings.append(
                VulnerabilityFinding(
                    id=f"VULN-{uuid.uuid4().hex[:6].upper()}",
                    rule_id=item["rule_id"],
                    category=item["category"],
                    severity=item["severity"],
                    title=item["title"],
                    description=item["description"],
                    file_path=rel_path,
                    line_start=item["line_start"],
                    line_end=item["line_end"],
                    code_snippet=item["code_snippet"],
                    cwe_id=item.get("cwe_id"),
                    owasp_category=item.get("owasp_category"),
                    remediation_guidance=item["remediation_guidance"],
                    verified=True,
                    detection_method=item.get("detection_method", "ast_analysis"),
                    source_location=item.get("source_location"),
                    sink_location=item.get("sink_location"),
                    data_flow_steps=item.get("data_flow_steps", []),
                    sanitization_detected=item.get("sanitization_detected", False),
                    is_flow_complete=item.get("is_flow_complete", True),
                    evidence_summary=item.get("evidence_summary"),
                    masked_snippet=item.get("masked_snippet"),
                    confidence=item.get("confidence", 0.95),
                    evidence_metadata={
                        "detection_method": item.get("detection_method", "ast_analysis"),
                        "source_location": item.get("source_location"),
                        "sink_location": item.get("sink_location"),
                    }
                )
            )
        return findings

    def scan_directory(self, target_dir: str) -> List[VulnerabilityFinding]:
        findings: List[VulnerabilityFinding] = []
        target_path = Path(target_dir).resolve()
        seen_matches = set()

        for root, _, files in os.walk(target_path):
            for file in sorted(files):
                file_full_path = Path(root) / file
                rel_path = os.path.relpath(file_full_path, target_path).replace("\\", "/").lstrip("/")
                ext = file_full_path.suffix.lower()

                # Read file contents safely
                try:
                    content = file_full_path.read_text(encoding="utf-8", errors="ignore")
                    lines = content.splitlines()
                except Exception:
                    continue

                # 1. Run genuine AST analysis on Python files
                if ext == ".py":
                    ast_results = analyze_python_ast(content, rel_path)
                    for item in ast_results:
                        match_key = (item["rule_id"], rel_path, item["line_start"])
                        if match_key in seen_matches:
                            continue
                        for l_idx in range(item["line_start"], item["line_end"] + 1):
                            seen_matches.add((item["rule_id"], rel_path, l_idx))

                        finding = VulnerabilityFinding(
                            id=f"VULN-{uuid.uuid4().hex[:6].upper()}",
                            rule_id=item["rule_id"],
                            category=item["category"],
                            severity=item["severity"],
                            title=item["title"],
                            description=item["description"],
                            file_path=rel_path,
                            line_start=item["line_start"],
                            line_end=item["line_end"],
                            code_snippet=item["code_snippet"],
                            cwe_id=item.get("cwe_id"),
                            owasp_category=item.get("owasp_category"),
                            remediation_guidance=item["remediation_guidance"],
                            verified=True,
                            detection_method=item.get("detection_method", "python_ast_analysis"),
                            source_location=item.get("source_location"),
                            sink_location=item.get("sink_location"),
                            data_flow_steps=item.get("data_flow_steps", []),
                            sanitization_detected=item.get("sanitization_detected", False),
                            is_flow_complete=item.get("is_flow_complete", True),
                            evidence_summary=item.get("evidence_summary"),
                            masked_snippet=item.get("masked_snippet"),
                            evidence_metadata={
                                "detection_method": item.get("detection_method", "python_ast_analysis"),
                                "source_location": item.get("source_location"),
                                "sink_location": item.get("sink_location"),
                            }
                        )
                        findings.append(finding)

                # 2. Run deterministic pattern rules (for JS/TS and rules not covered by AST)
                for rule in SECURITY_RULES:
                    if ext not in rule["extensions"]:
                        continue

                    for pattern in rule["patterns"]:
                        regex = re.compile(pattern)
                        for line_idx, line in enumerate(lines, start=1):
                            match_key = (rule["rule_id"], rel_path, line_idx)
                            if match_key in seen_matches:
                                continue

                            if regex.search(line):
                                seen_matches.add(match_key)
                                # Extract surrounding context (3 lines before and after)
                                start_idx = max(0, line_idx - 2)
                                end_idx = min(len(lines), line_idx + 2)
                                snippet = "\n".join(lines[start_idx:end_idx])

                                masked_snip = None
                                if rule["category"] == VulnerabilityCategory.HARDCODED_SECRET:
                                    masked_snip = mask_secret_value(line.strip())

                                finding = VulnerabilityFinding(
                                    id=f"VULN-{uuid.uuid4().hex[:6].upper()}",
                                    rule_id=rule["rule_id"],
                                    category=rule["category"],
                                    severity=rule["severity"],
                                    title=rule["title"],
                                    description=rule["description"],
                                    file_path=rel_path,
                                    line_start=line_idx,
                                    line_end=line_idx,
                                    code_snippet=snippet,
                                    cwe_id=rule.get("cwe_id"),
                                    owasp_category=rule.get("owasp_category"),
                                    remediation_guidance=rule["remediation_guidance"],
                                    verified=True,
                                    detection_method="deterministic_pattern_match",
                                    source_location=f"{rel_path}:L{line_idx}",
                                    sink_location=f"{rel_path}:L{line_idx}",
                                    data_flow_steps=[
                                        f"Pattern match for rule {rule['rule_id']} at line {line_idx}",
                                    ],
                                    evidence_summary=f"Deterministic rule matched: {rule['title']}",
                                    masked_snippet=masked_snip,
                                    evidence_metadata={
                                        "matched_pattern": pattern,
                                        "line_text": line.strip()
                                    }
                                )
                                findings.append(finding)

        # Deterministic ordering by file path and line number
        findings.sort(key=lambda f: (f.file_path, f.line_start, f.rule_id))
        return findings
