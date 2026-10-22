"""
backend/app/services/project_storage.py
Persistent on-disk project storage for CausalOps with strict database-backed ownership tracking.
Persists scan results, source code, and finding statuses across server restarts.
Each project lives at: backend/data/projects/{project_id}/
  manifest.json  - serialized CodebaseScanResult (updated on scan & patch)
  remediation_history.json - audit log of all patches applied
  source/ - persistent source directory containing actual codebase files
  scenario.json - project-specific incident scenario
"""
import json
import os
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, List, Any

from app.models.codebase_schemas import (
    CodebaseScanResult,
    VulnerabilityFinding,
    FindingStatus,
)
from app.models.schemas import Scenario
from app.db.database import db_manager

_DATA_ROOT = Path(__file__).parent.parent.parent / "data" / "projects"

# Canonical demo project identifier
DEMO_PROJECT_IDS = {"proj-demo-shoppulse"}


def _project_dir(project_id: str) -> Path:
    # Ensure project_id cannot contain path traversal characters
    safe_id = os.path.basename(project_id)
    return _DATA_ROOT / safe_id


def _manifest_path(project_id: str) -> Path:
    return _project_dir(project_id) / "manifest.json"


def _history_path(project_id: str) -> Path:
    return _project_dir(project_id) / "remediation_history.json"


def _source_dir(project_id: str) -> Path:
    return _project_dir(project_id) / "source"


def _scenario_path(project_id: str) -> Path:
    return _project_dir(project_id) / "scenario.json"


def is_demo_project(project_id: str) -> bool:
    """Returns True if the project is marked as demo."""
    if project_id in DEMO_PROJECT_IDS:
        return True
    try:
        with db_manager.session() as conn:
            row = conn.execute(
                "SELECT is_demo FROM project_ownership WHERE project_id = ?",
                (project_id,)
            ).fetchone()
            if row and row["is_demo"] == 1:
                return True
    except Exception:
        pass

    mp = _manifest_path(project_id)
    if mp.exists():
        try:
            data = json.loads(mp.read_text(encoding="utf-8"))
            return bool(data.get("is_demo", False))
        except Exception:
            pass
    return False


def register_project_ownership(
    project_id: str,
    owner_username: str,
    owner_user_id: Optional[str] = None,
    is_demo: bool = False,
) -> None:
    """Registers or updates project ownership in the persistent SQLite database."""
    now = time.time()
    with db_manager.session() as conn:
        conn.execute(
            """
            INSERT INTO project_ownership (project_id, owner_username, owner_user_id, is_demo, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id) DO UPDATE SET
                owner_username=excluded.owner_username,
                owner_user_id=COALESCE(excluded.owner_user_id, project_ownership.owner_user_id),
                is_demo=excluded.is_demo,
                updated_at=excluded.updated_at
            """,
            (project_id, owner_username, owner_user_id, 1 if is_demo else 0, now, now)
        )


def get_project_owner(project_id: str) -> Optional[str]:
    """Retrieves the owner username for a given project from DB or manifest."""
    try:
        with db_manager.session() as conn:
            row = conn.execute(
                "SELECT owner_username FROM project_ownership WHERE project_id = ?",
                (project_id,)
            ).fetchone()
            if row and row["owner_username"]:
                return row["owner_username"]
    except Exception:
        pass

    # Fallback to manifest check
    proj = get_project(project_id)
    if proj:
        return proj.owner_username
    return None


def save_project(result: CodebaseScanResult) -> None:
    """Persist (or overwrite) a scan result to disk and sync DB ownership."""
    p = _project_dir(result.project_id)
    p.mkdir(parents=True, exist_ok=True)
    manifest = _manifest_path(result.project_id)
    manifest.write_text(result.model_dump_json(indent=2), encoding="utf-8")

    # Sync ownership to database if owner_username is present
    if result.owner_username:
        register_project_ownership(
            result.project_id,
            result.owner_username,
            is_demo=result.is_demo
        )
    elif result.is_demo or result.project_id in DEMO_PROJECT_IDS:
        register_project_ownership(
            result.project_id,
            "system",
            is_demo=True
        )


def get_project(project_id: str) -> Optional[CodebaseScanResult]:
    """Load a previously persisted scan result from disk."""
    mp = _manifest_path(project_id)
    if not mp.exists():
        return None
    try:
        data = json.loads(mp.read_text(encoding="utf-8"))
        return CodebaseScanResult.model_validate(data)
    except Exception:
        return None


def list_projects() -> List[str]:
    """Return all persisted project IDs (directories with manifest.json)."""
    if not _DATA_ROOT.exists():
        return []
    return [
        d.name
        for d in _DATA_ROOT.iterdir()
        if d.is_dir() and (_manifest_path(d.name)).exists()
    ]


def list_user_projects_summary(owner_username: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return summary metadata for persisted projects strictly scoped to owner_username (plus demo projects)."""
    db_owners = {}
    try:
        with db_manager.session() as conn:
            if owner_username:
                rows = conn.execute(
                    "SELECT project_id, owner_username, is_demo FROM project_ownership WHERE owner_username = ? OR is_demo = 1",
                    (owner_username,)
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT project_id, owner_username, is_demo FROM project_ownership WHERE is_demo = 1"
                ).fetchall()
            for r in rows:
                db_owners[r["project_id"]] = (r["owner_username"], bool(r["is_demo"]))
    except Exception:
        pass

    # Ensure known demo projects are always present in the dictionary
    for d_id in DEMO_PROJECT_IDS:
        if d_id not in db_owners:
            db_owners[d_id] = ("system", True)

    summaries = []
    for pid, (proj_owner, is_demo) in db_owners.items():
        mp = _manifest_path(pid)
        if not mp.exists():
            continue
        try:
            data = json.loads(mp.read_text(encoding="utf-8"))
        except Exception:
            continue

        manifest_obj = data.get("manifest") or {}
        summaries.append({
            "project_id": data.get("project_id", pid),
            "project_name": data.get("project_name") or pid,
            "is_demo": bool(data.get("is_demo", is_demo)),
            "owner_username": proj_owner or data.get("owner_username"),
            "repository_url": data.get("repository_url"),
            "branch": data.get("branch"),
            "commit_sha": data.get("commit_sha"),
            "total_findings": data.get("total_findings", 0),
            "open_findings_count": data.get("open_findings_count", 0),
            "fixed_findings_count": data.get("fixed_findings_count", 0),
            "critical_count": data.get("critical_count", 0),
            "high_count": data.get("high_count", 0),
            "medium_count": data.get("medium_count", 0),
            "low_count": data.get("low_count", 0),
            "scan_timestamp": data.get("scan_timestamp", 0),
            "status": data.get("status", "complete"),
            "detected_languages": manifest_obj.get("detected_languages", []),
            "detected_frameworks": manifest_obj.get("detected_frameworks", []),
        })
    return summaries


def save_project_source(project_id: str, source_dir_or_files: Dict[str, str]) -> None:
    """Save/update real source files on disk safely without path traversal."""
    sdir = _source_dir(project_id)
    sdir.mkdir(parents=True, exist_ok=True)
    canonical_root = sdir.resolve()

    for rel_path, content in source_dir_or_files.items():
        # Prevent path traversal outside project source directory
        clean_rel = rel_path.replace("/", os.sep).lstrip(os.sep)
        file_path = (sdir / clean_rel).resolve()
        if not str(file_path).startswith(str(canonical_root)):
            continue
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content, encoding="utf-8")


def get_source_file_content(project_id: str, rel_path: str) -> Optional[str]:
    """Read a specific source file from disk safely."""
    sdir = _source_dir(project_id)
    canonical_root = sdir.resolve()
    clean_rel = rel_path.replace("/", os.sep).lstrip(os.sep)
    file_path = (sdir / clean_rel).resolve()

    if not str(file_path).startswith(str(canonical_root)) or not file_path.exists():
        return None
    try:
        return file_path.read_text(encoding="utf-8")
    except Exception:
        return None


def write_source_file(project_id: str, rel_path: str, content: str) -> bool:
    """Writes updated content into a source file on disk safely."""
    sdir = _source_dir(project_id)
    canonical_root = sdir.resolve()
    clean_rel = rel_path.replace("/", os.sep).lstrip(os.sep)
    file_path = (sdir / clean_rel).resolve()

    if not str(file_path).startswith(str(canonical_root)):
        return False
    try:
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content, encoding="utf-8")
        return True
    except Exception:
        return False


def save_project_scenario(project_id: str, scenario: Scenario) -> None:
    """Persist the project-specific incident scenario."""
    p = _project_dir(project_id)
    p.mkdir(parents=True, exist_ok=True)
    spath = _scenario_path(project_id)
    spath.write_text(scenario.model_dump_json(indent=2), encoding="utf-8")


def get_project_scenario(project_id: str) -> Optional[Scenario]:
    """Get the persisted project incident scenario if present."""
    spath = _scenario_path(project_id)
    if not spath.exists():
        return None
    try:
        data = json.loads(spath.read_text(encoding="utf-8"))
        return Scenario.model_validate(data)
    except Exception:
        return None


def apply_finding_status(
    project_id: str,
    finding_id: str,
    new_status: FindingStatus,
    fixed_at: Optional[str] = None,
) -> Optional[CodebaseScanResult]:
    """
    Update the status of a single finding and re-compute aggregate counts.
    Returns the updated CodebaseScanResult, or None if project not found.
    """
    result = get_project(project_id)
    if result is None:
        return None

    updated_findings: List[VulnerabilityFinding] = []
    found = False
    for f in result.findings:
        if f.id == finding_id:
            found = True
            f_updated = f.model_copy(update={
                "finding_status": new_status,
                "fixed_at": fixed_at or (datetime.now(timezone.utc).isoformat() if new_status == FindingStatus.VERIFIED_FIXED else None)
            })
            updated_findings.append(f_updated)
        else:
            updated_findings.append(f)

    if not found:
        return result

    fixed_count = sum(1 for f in updated_findings if f.finding_status == FindingStatus.VERIFIED_FIXED)
    open_count = len(updated_findings) - fixed_count

    result.findings = updated_findings
    result.fixed_findings_count = fixed_count
    result.open_findings_count = open_count

    save_project(result)

    if new_status == FindingStatus.VERIFIED_FIXED:
        record_remediation_event(
            project_id=project_id,
            finding_id=finding_id,
            action="APPLY_PATCH",
            status="VERIFIED_FIXED",
            details="Patch applied and verified against static security rules on persisted working copy."
        )

    return result


def record_remediation_event(
    project_id: str,
    finding_id: str,
    action: str,
    status: str,
    details: str,
) -> None:
    """Append an event to the project's persistent remediation audit history."""
    p = _project_dir(project_id)
    p.mkdir(parents=True, exist_ok=True)
    hpath = _history_path(project_id)
    history: List[Dict] = []
    if hpath.exists():
        try:
            history = json.loads(hpath.read_text(encoding="utf-8"))
        except Exception:
            history = []

    history.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "finding_id": finding_id,
        "action": action,
        "status": status,
        "details": details,
    })
    hpath.write_text(json.dumps(history, indent=2), encoding="utf-8")


def get_remediation_history(project_id: str) -> List[Dict]:
    """Retrieve the remediation audit history for a project."""
    hpath = _history_path(project_id)
    if not hpath.exists():
        return []
    try:
        return json.loads(hpath.read_text(encoding="utf-8"))
    except Exception:
        return []


def delete_project(project_id: str) -> bool:
    """
    Physically removes the project directory from disk and deletes its ownership row from the database.
    Returns True if successfully deleted, False otherwise.
    """
    # 1. Clean DB ownership
    try:
        with db_manager.session() as conn:
            conn.execute("DELETE FROM project_ownership WHERE project_id = ?", (project_id,))
    except Exception as e:
        logger.warning(f"Failed to delete project ownership for {project_id}: {e}")

    # 2. Clean disk directory
    pdir = _project_dir(project_id)
    if pdir.exists():
        try:
            shutil.rmtree(pdir, ignore_errors=True)
            return not pdir.exists()
        except Exception as e:
            logger.warning(f"Failed to remove project dir {pdir}: {e}")
            return False
    return True

