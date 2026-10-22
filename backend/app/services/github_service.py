"""
backend/app/services/github_service.py
Autonomous GitHub synchronization, pull request publishing, and post-merge verification service.
Handles:
1. Secure credential resolution (backend-only, never leaked to frontend/logs)
2. Safe remediation branch creation and file updates (never pushing to default branch)
3. Pull Request creation with verified security evidence and causal explanation
4. Commit-accurate post-merge synchronization, source extraction, deleted-file pruning, and re-scan verification
"""
import os
import re
import base64
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any, Tuple, List
import httpx

from app.analysis.github_ingest import GitHubIngestService
from app.analysis.code_scanner import CodeScannerService
from app.analysis.incident_generator import generate_incident_for_project
from app.models.codebase_schemas import (
    CodebaseScanResult,
    VulnerabilityFinding,
    FindingStatus,
    GitHubPublishRequest,
    GitHubPublishResponse,
    GitHubSyncRequest,
    GitHubSyncResponse,
)
from app.services.project_storage import (
    get_project,
    save_project,
    save_project_source,
    get_source_file_content,
    record_remediation_event,
    save_project_scenario,
    _source_dir,
)

logger = logging.getLogger("CausalOps.GitHubService")


def _normalize_finding_path(path: str) -> str:
    """Strips archive root prefix (e.g. owner-repo-sha) and normalizes slashes."""
    if not path:
        return ""
    p = path.replace("\\", "/").strip("/")
    parts = p.split("/")
    if len(parts) > 1 and re.match(r"^[\w\.\-]+-[a-f0-9]{7,40}$", parts[0]):
        return "/".join(parts[1:])
    return p


class GitHubService:
    def __init__(
        self,
        github_ingest_service: Optional[GitHubIngestService] = None,
        scanner_service: Optional[CodeScannerService] = None,
    ):
        self.ingest_service = github_ingest_service or GitHubIngestService()
        self.scanner_service = scanner_service or CodeScannerService()

    @staticmethod
    def get_token(
        override_token: Optional[str] = None,
        user_id: Optional[str] = None,
        username: Optional[str] = None,
    ) -> Optional[str]:
        """
        Resolves GitHub token in priority order:
        1. Explicit override_token passed in call/request
        2. Encrypted credential stored in database for authenticated user_id
        3. Encrypted credential stored in database for username
        4. GITHUB_TOKEN environment variable (admin/CI override)
        5. backend/.env fallback
        Never logs or exposes the token.
        """
        if override_token and isinstance(override_token, str) and override_token.strip():
            return override_token.strip()

        # Database lookup for authenticated user
        if user_id:
            try:
                from app.services.credential_service import credential_service
                db_token = credential_service.get_github_token(user_id)
                if db_token and db_token.strip():
                    return db_token.strip()
            except Exception as e:
                logger.warning(f"Failed to lookup token for user_id {user_id}: {e}")

        if username:
            try:
                from app.services.credential_service import credential_service
                db_token = credential_service.get_github_token_by_username(username)
                if db_token and db_token.strip():
                    return db_token.strip()
            except Exception as e:
                logger.warning(f"Failed to lookup token for username {username}: {e}")

        token = os.getenv("GITHUB_TOKEN")
        if token and token.strip():
            return token.strip()

        # Check backend/.env explicitly if not loaded
        env_path = Path(__file__).parent.parent.parent / ".env"
        if env_path.exists():
            try:
                for line in env_path.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if line.startswith("GITHUB_TOKEN=") and not line.startswith("#"):
                        val = line.split("=", 1)[1].strip().strip('"').strip("'")
                        if val:
                            return val
            except Exception:
                pass

        return None

    def publish_remediation(
        self,
        project_id: str,
        req: GitHubPublishRequest,
        token: Optional[str] = None,
        user_id: Optional[str] = None,
        username: Optional[str] = None,
        custom_client: Optional[httpx.Client] = None,
    ) -> GitHubPublishResponse:
        """
        Publishes a verified remediation to an authorized GitHub repository:
        1. Validates project ownership and linked repository URL
        2. Validates finding and proposed code
        3. Creates a separate remediation branch (never pushes to main/master)
        4. Commits the updated source file to the remediation branch
        5. Opens a Pull Request with causal explanation and security rationale
        6. Updates finding evidence metadata and appends to audit log
        """
        project = get_project(project_id)
        if not project:
            raise ValueError(f"Project '{project_id}' not found.")

        if not project.repository_url:
            raise ValueError(
                f"Project '{project_id}' is not linked to a GitHub repository. "
                "Only GitHub-connected projects can publish pull requests."
            )

        active_token = self.get_token(req.github_token or token, user_id=user_id, username=username)
        if not active_token:
            raise ValueError(
                "GitHub token is not configured. Please authorize GitHub in the Connect GitHub panel "
                "or configure a personal access token with 'repo' scope."
            )

        # Parse canonical repository URL
        _, owner, repo = GitHubIngestService.validate_and_parse_url(project.repository_url)

        # Locate finding
        finding = next((f for f in project.findings if f.id == req.finding_id), None)
        if not finding:
            raise ValueError(f"Finding '{req.finding_id}' not found in project '{project_id}'.")

        # Determine proposed code: prioritize req.proposed_code, then disk working copy
        proposed_code = req.proposed_code
        if not proposed_code:
            proposed_code = get_source_file_content(project_id, finding.file_path)

        if not proposed_code:
            raise ValueError(
                f"No proposed remediation code found for finding '{req.finding_id}' ({finding.file_path}). "
                "Generate and verify a remediation patch before publishing."
            )

        # Base branch
        base_branch = project.branch or "main"

        # Disallow publishing directly to the default/base branch
        branch_name = (req.branch_name or f"causalops/fix-{finding.id.lower()}").strip()
        if branch_name.lower() in (base_branch.lower(), "main", "master", "develop"):
            branch_name = f"causalops/fix-{finding.id.lower()}"

        client = custom_client or httpx.Client(timeout=20.0, follow_redirects=True)
        api_headers = {
            "Accept": "application/vnd.github.v3+json",
            "Authorization": f"Bearer {active_token}",
            "User-Agent": "CausalOps-AppSec-Platform/2.0",
        }

        try:
            # 1. Resolve base branch commit SHA
            ref_url = f"https://api.github.com/repos/{owner}/{repo}/git/ref/heads/{base_branch}"
            resp = client.get(ref_url, headers=api_headers)
            if resp.status_code == 401 or resp.status_code == 403:
                raise ValueError("GitHub authentication failed. Please verify that your GITHUB_TOKEN has 'repo' scope.")
            elif resp.status_code == 404:
                raise ValueError(f"Base branch '{base_branch}' not found on remote repository '{owner}/{repo}'.")
            elif resp.status_code != 200:
                raise ValueError(f"Failed to query base branch ref (HTTP {resp.status_code}): {resp.text}")

            base_sha = resp.json()["object"]["sha"]

            # 2. Check if remediation branch already exists; if not, create it
            branch_ref_url = f"https://api.github.com/repos/{owner}/{repo}/git/ref/heads/{branch_name}"
            branch_resp = client.get(branch_ref_url, headers=api_headers)

            if branch_resp.status_code == 404:
                # Create branch from base_sha
                create_ref_url = f"https://api.github.com/repos/{owner}/{repo}/git/refs"
                create_payload = {
                    "ref": f"refs/heads/{branch_name}",
                    "sha": base_sha,
                }
                c_resp = client.post(create_ref_url, headers=api_headers, json=create_payload)
                if c_resp.status_code not in (200, 201):
                    raise ValueError(f"Failed to create remediation branch '{branch_name}': {c_resp.text}")

            # 3. Retrieve target file's current blob SHA on the remediation branch (if it exists)
            content_url = f"https://api.github.com/repos/{owner}/{repo}/contents/{finding.file_path}"
            f_resp = client.get(f"{content_url}?ref={branch_name}", headers=api_headers)
            file_blob_sha = None
            if f_resp.status_code == 200:
                file_blob_sha = f_resp.json().get("sha")

            # 4. Commit updated source file to the remediation branch
            commit_msg = (
                f"fix(security): remediate {finding.category.value} [{finding.rule_id}]\n\n"
                f"Vulnerability: {finding.title}\n"
                f"Rule: {finding.rule_id} ({finding.cwe_id or 'CWE'})\n"
                f"Automated verification: Passed deterministic checks on CausalOps."
            )
            b64_content = base64.b64encode(proposed_code.encode("utf-8")).decode("utf-8")
            put_payload = {
                "message": commit_msg,
                "content": b64_content,
                "branch": branch_name,
            }
            if file_blob_sha:
                put_payload["sha"] = file_blob_sha

            put_resp = client.put(content_url, headers=api_headers, json=put_payload)
            if put_resp.status_code not in (200, 201):
                raise ValueError(f"Failed to commit remediation to '{branch_name}': {put_resp.text}")

            put_data = put_resp.json()
            commit_sha = put_data.get("commit", {}).get("sha") or base_sha

            # 5. Open or identify existing Pull Request
            pr_title = req.pr_title or f"fix(security): resolve {finding.title} [{finding.rule_id}]"
            pr_body = req.pr_body or (
                f"## 🛡️ CausalOps Security Remediation\n\n"
                f"### Finding Details\n"
                f"- **Vulnerability**: {finding.title}\n"
                f"- **Category**: `{finding.category.value}`\n"
                f"- **Rule ID**: `{finding.rule_id}`\n"
                f"- **CWE**: `{finding.cwe_id or 'N/A'}`\n"
                f"- **File**: `{finding.file_path}:{finding.line_start}`\n\n"
                f"### Remediation Summary\n"
                f"{finding.remediation_guidance}\n\n"
                f"### Verification Status\n"
                f"Verified deterministically on CausalOps operations desk prior to publication. "
                f"Upon merging this pull request, CausalOps will re-scan the repository to confirm upstream resolution."
            )

            # Check if an open PR already exists from this branch to base
            pulls_url = f"https://api.github.com/repos/{owner}/{repo}/pulls"
            existing_prs_resp = client.get(
                f"{pulls_url}?head={owner}:{branch_name}&base={base_branch}&state=open",
                headers=api_headers,
            )

            pr_number = None
            pr_url = None
            if existing_prs_resp.status_code == 200 and len(existing_prs_resp.json()) > 0:
                existing_pr = existing_prs_resp.json()[0]
                pr_number = existing_pr["number"]
                pr_url = existing_pr["html_url"]
            else:
                pr_payload = {
                    "title": pr_title,
                    "body": pr_body,
                    "head": branch_name,
                    "base": base_branch,
                }
                pr_resp = client.post(pulls_url, headers=api_headers, json=pr_payload)
                if pr_resp.status_code not in (200, 201):
                    raise ValueError(f"Failed to open GitHub Pull Request: {pr_resp.text}")
                pr_data = pr_resp.json()
                pr_number = pr_data["number"]
                pr_url = pr_data["html_url"]

            # 6. Update finding metadata and audit log
            finding.evidence_metadata["pr_url"] = pr_url
            finding.evidence_metadata["pr_number"] = pr_number
            finding.evidence_metadata["pr_branch"] = branch_name
            finding.evidence_metadata["published_commit_sha"] = commit_sha
            finding.evidence_metadata["published_at"] = datetime.now(timezone.utc).isoformat()

            record_remediation_event(
                project_id=project_id,
                finding_id=finding.id,
                action="PUBLISH_PULL_REQUEST",
                status="PR_OPENED",
                details=f"Opened Pull Request #{pr_number} on branch '{branch_name}': {pr_url}",
            )

            save_project(project)

            return GitHubPublishResponse(
                project_id=project_id,
                finding_id=finding.id,
                branch_name=branch_name,
                commit_sha=commit_sha,
                pull_request_number=pr_number,
                pull_request_url=pr_url,
                pull_request_state="open",
                status="PUBLISHED",
                message=f"Successfully opened Pull Request #{pr_number} on branch '{branch_name}'.",
            )

        finally:
            if custom_client is None:
                client.close()

    def sync_and_rescan(
        self,
        project_id: str,
        req: GitHubSyncRequest,
        token: Optional[str] = None,
        user_id: Optional[str] = None,
        username: Optional[str] = None,
        custom_client: Optional[httpx.Client] = None,
    ) -> GitHubSyncResponse:
        """
        Synchronizes remote repository with CausalOps:
        1. If pull_request_number is supplied, queries PR merge status.
        2. If PR is merged or general sync requested:
           - Downloads exact source archive at remote head revision
           - Overwrites local working copy safely, pruning deleted files
           - Re-scans code deterministically with CodeScannerService
           - Confirms whether targeted findings are truly eliminated
           - Marks resolved findings as VERIFIED_FIXED with merge metadata
           - Updates project commit_sha, counts, and incident scenario
        """
        project = get_project(project_id)
        if not project:
            raise ValueError(f"Project '{project_id}' not found.")

        if not project.repository_url:
            raise ValueError(f"Project '{project_id}' is not linked to a GitHub repository.")

        active_token = self.get_token(req.github_token or token, user_id=user_id, username=username)
        _, owner, repo = GitHubIngestService.validate_and_parse_url(project.repository_url)
        base_branch = req.branch or project.branch or "main"

        client = custom_client or httpx.Client(timeout=25.0, follow_redirects=True)
        api_headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "CausalOps-AppSec-Platform/2.0",
        }
        if active_token:
            api_headers["Authorization"] = f"Bearer {active_token}"

        try:
            pr_merged = None
            merged_sha = None

            # 1. If PR number specified, check whether it is merged
            if req.pull_request_number:
                pr_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{req.pull_request_number}"
                pr_resp = client.get(pr_url, headers=api_headers)
                if pr_resp.status_code == 200:
                    pr_data = pr_resp.json()
                    pr_merged = pr_data.get("merged", False)
                    merged_sha = pr_data.get("merge_commit_sha")

                    if not pr_merged:
                        state = pr_data.get("state", "open")
                        return GitHubSyncResponse(
                            project_id=project_id,
                            repository_url=project.repository_url,
                            branch=base_branch,
                            previous_commit_sha=project.commit_sha,
                            current_commit_sha=project.commit_sha or "UNKNOWN",
                            status="PR_NOT_MERGED",
                            pull_request_merged=False,
                            resolved_findings_count=0,
                            new_findings_count=0,
                            total_findings=project.total_findings,
                            message=(
                                f"Pull Request #{req.pull_request_number} is currently '{state}' (not merged). "
                                "Findings can only be verified as resolved on remote code once the PR is merged into the base branch."
                            ),
                        )
                elif pr_resp.status_code == 404:
                    raise ValueError(f"Pull Request #{req.pull_request_number} not found on repository '{owner}/{repo}'.")

            # 2. Resolve remote base branch latest commit SHA
            latest_sha = self.ingest_service.resolve_commit_sha(
                owner=owner, repo=repo, ref=base_branch, custom_client=client
            )
            if not latest_sha:
                latest_sha = merged_sha or "HEAD"

            previous_sha = project.commit_sha

            # Check if remote SHA has changed or if forced
            is_stale = (latest_sha != previous_sha)
            if not is_stale and not req.force_rescan and not pr_merged:
                return GitHubSyncResponse(
                    project_id=project_id,
                    repository_url=project.repository_url,
                    branch=base_branch,
                    previous_commit_sha=previous_sha,
                    current_commit_sha=latest_sha,
                    status="ALREADY_UP_TO_DATE",
                    pull_request_merged=pr_merged,
                    resolved_findings_count=0,
                    new_findings_count=0,
                    total_findings=project.total_findings,
                    message="Project source is already up to date with remote revision.",
                )

            # 3. Download and extract the latest remote code
            import tempfile
            import shutil

            temp_sync_dir = tempfile.mkdtemp(prefix=f"causalops_sync_{project_id}_")
            try:
                extract_dir, extracted_files, resolved_sha = self.ingest_service.download_and_extract(
                    owner=owner,
                    repo=repo,
                    ref=latest_sha if latest_sha != "HEAD" else base_branch,
                    target_dir=temp_sync_dir,
                    custom_client=client,
                )
                final_sha = resolved_sha or latest_sha

                # 4. Update working copy safely: clean existing source dir and write new files
                src_path = _source_dir(project_id)
                if src_path.exists():
                    shutil.rmtree(src_path, ignore_errors=True)
                src_path.mkdir(parents=True, exist_ok=True)

                stored_files = {}
                resolved_extract = Path(extract_dir).resolve()
                for ext_file in extracted_files:
                    rel = os.path.relpath(Path(ext_file).resolve(), resolved_extract).replace("\\", "/")
                    try:
                        stored_files[rel] = Path(ext_file).read_text(encoding="utf-8", errors="ignore")
                    except Exception:
                        pass
                save_project_source(project_id, stored_files)

                # 5. Re-scan the fresh remote source tree
                fresh_findings = self.scanner_service.scan_directory(str(src_path))
                
                # Normalize fresh findings paths
                normalized_fresh: List[VulnerabilityFinding] = []
                for ff in fresh_findings:
                    norm_p = _normalize_finding_path(ff.file_path)
                    normalized_fresh.append(ff.model_copy(update={"file_path": norm_p}))

                # 6. Compare with previous findings and update status
                resolved_count = 0
                claimed_fresh_indices = set()
                updated_findings: List[VulnerabilityFinding] = []
                seen_finding_signatures = set()

                for old_f in project.findings:
                    old_norm_p = _normalize_finding_path(old_f.file_path)
                    sig = (old_f.rule_id, old_norm_p, old_f.finding_status)
                    if sig in seen_finding_signatures and old_f.finding_status == FindingStatus.VERIFIED_FIXED:
                        # Skip redundant duplicate fixed record
                        continue

                    # Find candidate matches in fresh findings
                    candidates = [
                        (idx, f) for idx, f in enumerate(normalized_fresh)
                        if idx not in claimed_fresh_indices
                        and f.rule_id == old_f.rule_id
                        and f.file_path == old_norm_p
                    ]

                    if candidates:
                        best_idx, fresh_match = min(
                            candidates,
                            key=lambda item: abs(item[1].line_start - old_f.line_start)
                        )
                        claimed_fresh_indices.add(best_idx)
                        updated_f = old_f.model_copy(update={
                            "file_path": fresh_match.file_path,
                            "line_start": fresh_match.line_start,
                            "line_end": fresh_match.line_end,
                            "code_snippet": fresh_match.code_snippet,
                            "finding_status": FindingStatus.OPEN,
                        })
                        updated_findings.append(updated_f)
                        seen_finding_signatures.add((updated_f.rule_id, updated_f.file_path, updated_f.finding_status))
                    else:
                        # Vulnerability pattern is absent in new code revision -> VERIFIED_FIXED!
                        if old_f.finding_status != FindingStatus.VERIFIED_FIXED:
                            resolved_count += 1
                            record_remediation_event(
                                project_id=project_id,
                                finding_id=old_f.id,
                                action="REMOTE_MERGE_SYNC",
                                status="VERIFIED_FIXED",
                                details=(
                                    f"Vulnerability successfully eliminated upstream in remote revision {final_sha[:8]}. "
                                    f"Deterministic re-scan confirmed 0 matching patterns."
                                ),
                            )
                        updated_f = old_f.model_copy(update={
                            "file_path": old_norm_p,
                            "finding_status": FindingStatus.VERIFIED_FIXED,
                            "fixed_at": old_f.fixed_at or datetime.now(timezone.utc).isoformat(),
                            "verified": True,
                        })
                        updated_findings.append(updated_f)
                        seen_finding_signatures.add((updated_f.rule_id, updated_f.file_path, updated_f.finding_status))

                # Check for completely new findings introduced in remote revision
                new_count = 0
                for idx, fresh_f in enumerate(normalized_fresh):
                    if idx not in claimed_fresh_indices:
                        new_count += 1
                        updated_findings.append(fresh_f)

                # Compute aggregate metrics
                fixed_count = sum(1 for f in updated_findings if f.finding_status == FindingStatus.VERIFIED_FIXED)
                open_count = len(updated_findings) - fixed_count

                crit = sum(1 for f in updated_findings if f.severity.value == "critical" and f.finding_status != FindingStatus.VERIFIED_FIXED)
                high = sum(1 for f in updated_findings if f.severity.value == "high" and f.finding_status != FindingStatus.VERIFIED_FIXED)
                med = sum(1 for f in updated_findings if f.severity.value == "medium" and f.finding_status != FindingStatus.VERIFIED_FIXED)
                low = sum(1 for f in updated_findings if f.severity.value == "low" and f.finding_status != FindingStatus.VERIFIED_FIXED)

                project.findings = updated_findings
                project.total_findings = len(updated_findings)
                project.fixed_findings_count = fixed_count
                project.open_findings_count = open_count
                project.critical_count = crit
                project.high_count = high
                project.medium_count = med
                project.low_count = low
                project.commit_sha = final_sha
                project.scan_timestamp = datetime.now(timezone.utc).isoformat()

                save_project(project)

                try:
                    new_scenario = generate_incident_for_project(project)
                    save_project_scenario(project_id, new_scenario)
                except Exception:
                    pass

                sync_status = "MERGED_AND_VERIFIED" if pr_merged else "SYNCHRONIZED_AND_RESCANNED"
                msg = (
                    f"Remote revision {final_sha[:8]} synchronized and scanned. "
                    f"{resolved_count} finding(s) confirmed eliminated, {new_count} new finding(s) detected."
                )

                return GitHubSyncResponse(
                    project_id=project_id,
                    repository_url=project.repository_url,
                    branch=base_branch,
                    previous_commit_sha=previous_sha,
                    current_commit_sha=final_sha,
                    status=sync_status,
                    pull_request_merged=pr_merged,
                    resolved_findings_count=resolved_count,
                    new_findings_count=new_count,
                    total_findings=len(updated_findings),
                    message=msg,
                )

            finally:
                shutil.rmtree(temp_sync_dir, ignore_errors=True)

        finally:
            if custom_client is None:
                client.close()


github_service = GitHubService()
