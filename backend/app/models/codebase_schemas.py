from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum

class VulnerabilitySeverity(str, Enum):
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class VulnerabilityCategory(str, Enum):
    SQL_INJECTION = "sql_injection"
    COMMAND_INJECTION = "command_injection"
    HARDCODED_SECRET = "hardcoded_secret"
    INSECURE_DESERIALIZATION = "insecure_deserialization"
    PATH_TRAVERSAL = "path_traversal"
    WEAK_CRYPTO = "weak_crypto"
    INSECURE_CORS = "insecure_cors"
    MISSING_AUTH = "missing_auth"
    XSS = "cross_site_scripting"

class FindingStatus(str, Enum):
    OPEN = "OPEN"
    FIX_PROPOSED = "FIX_PROPOSED"
    APPLIED = "APPLIED"
    VERIFIED_FIXED = "VERIFIED_FIXED"
    VERIFICATION_FAILED = "VERIFICATION_FAILED"

class VerificationOutcome(str, Enum):
    VERIFIED = "VERIFIED"
    FAILED = "FAILED"
    INCONCLUSIVE = "INCONCLUSIVE"

class SourceSinkTrace(BaseModel):
    source_expression: Optional[str] = None
    source_line: Optional[int] = None
    sink_expression: Optional[str] = None
    sink_line: Optional[int] = None
    intermediate_steps: List[str] = Field(default_factory=list)
    sanitization_detected: bool = False
    sanitization_evidence: Optional[str] = None
    is_flow_complete: bool = False
    known_limitations: Optional[str] = None

class VulnerabilityFinding(BaseModel):
    id: str
    rule_id: str
    category: VulnerabilityCategory
    severity: VulnerabilitySeverity
    title: str
    description: str
    file_path: str
    line_start: int
    line_end: int
    code_snippet: str
    cwe_id: Optional[str] = None
    owasp_category: Optional[str] = None
    remediation_guidance: str
    verified: bool = False
    evidence_metadata: Dict[str, Any] = Field(default_factory=dict)
    finding_status: FindingStatus = FindingStatus.OPEN
    fixed_at: Optional[str] = None
    # Phase 4 Evidence Enhancements
    detection_method: str = "ast_analysis"
    evidence_summary: Optional[str] = None
    source_location: Optional[str] = None
    sink_location: Optional[str] = None
    data_flow_steps: List[str] = Field(default_factory=list)
    sanitization_detected: bool = False
    sanitization_notes: Optional[str] = None
    is_flow_complete: bool = False
    masked_snippet: Optional[str] = None
    confidence: float = 1.0

class ProjectType(str, Enum):
    WEB_APP = "web_app"
    API_BACKEND = "api_backend"
    FULL_STACK = "full_stack"
    UNKNOWN = "unknown"

class CodebaseManifest(BaseModel):
    project_name: str
    detected_languages: List[str] = Field(default_factory=list)
    detected_frameworks: List[str] = Field(default_factory=list)
    project_type: ProjectType = ProjectType.UNKNOWN
    total_files: int = 0
    scanned_files: int = 0
    source_files: List[str] = Field(default_factory=list)

class ProposedPatch(BaseModel):
    finding_id: str
    file_path: str
    original_code: str
    proposed_code: str
    diff: str
    explanation: str
    verification_status: str = "PENDING_REVIEW" # PENDING_REVIEW, APPLIED, VERIFIED_FIXED, FIX_FAILED
    # Phase 4 Remediation Enhancements
    expected_security_effect: Optional[str] = None
    regression_risks: Optional[str] = None
    verification_guidance: Optional[str] = None
    remediation_source: str = "gemma-4-26b-a4b-it"
    is_fallback: bool = False

class PatchVerifyResponse(BaseModel):
    finding_id: str
    verification_status: str
    verified: bool
    outcome: VerificationOutcome
    message: str
    syntax_valid: bool = True
    target_finding_eliminated: bool = True
    new_findings_introduced: int = 0
    attack_path_severed: bool = False
    rescan_findings_count: int = 0
    scenario_regenerated: bool = False
    evidence_report: Dict[str, Any] = Field(default_factory=dict)

class CodebaseScanResult(BaseModel):
    project_id: str
    project_name: str
    manifest: CodebaseManifest
    findings: List[VulnerabilityFinding] = Field(default_factory=list)
    total_findings: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    open_findings_count: int = 0
    fixed_findings_count: int = 0
    is_demo: bool = False
    scan_timestamp: str
    status: str = "COMPLETED" # COMPLETED, PARTIAL, FAILED
    error_message: Optional[str] = None
    owner_username: Optional[str] = None
    repository_url: Optional[str] = None
    branch: Optional[str] = None
    commit_sha: Optional[str] = None


class GitHubPublishRequest(BaseModel):
    finding_id: str
    proposed_code: Optional[str] = None
    branch_name: Optional[str] = None
    pr_title: Optional[str] = None
    pr_body: Optional[str] = None
    github_token: Optional[str] = None


class GitHubPublishResponse(BaseModel):
    project_id: str
    finding_id: str
    branch_name: str
    commit_sha: str
    pull_request_number: int
    pull_request_url: str
    pull_request_state: str = "open"
    status: str = "PUBLISHED"
    message: str


class GitHubSyncRequest(BaseModel):
    branch: Optional[str] = None
    pull_request_number: Optional[int] = None
    force_rescan: bool = False
    github_token: Optional[str] = None


class GitHubSyncResponse(BaseModel):
    project_id: str
    repository_url: str
    branch: str
    previous_commit_sha: Optional[str] = None
    current_commit_sha: str
    status: str
    pull_request_merged: Optional[bool] = None
    resolved_findings_count: int = 0
    new_findings_count: int = 0
    total_findings: int = 0
    message: str
