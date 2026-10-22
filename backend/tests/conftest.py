import os
import pytest
from pathlib import Path
from app.db.database import db_manager
from app.services.project_storage import _DATA_ROOT, delete_project

# Genuine projects and demo fixtures that must be preserved
PROTECTED_PROJECT_IDS = {
    "proj-demo-shoppulse",
    "proj-26de956e",
    "proj-705111ef",
    "proj-ac7dc5a9",
    "proj-b9368a67",
    "proj-da77c28e",
}


@pytest.fixture(autouse=True)
def isolate_and_cleanup_test_data():
    """
    Autouse fixture that prevents test data from accumulating on disk or in the database.
    Snapshots projects and users before each test, and removes any newly created test artifacts
    upon completion.
    """
    # 1. Snapshot existing project directories
    initial_projects = set()
    if _DATA_ROOT.exists():
        initial_projects = {d.name for d in _DATA_ROOT.iterdir() if d.is_dir()}

    # 2. Snapshot existing database user IDs
    initial_user_ids = set()
    try:
        with db_manager.session() as conn:
            rows = conn.execute("SELECT id FROM users").fetchall()
            initial_user_ids = {r["id"] for r in rows}
    except Exception:
        pass

    yield

    # 3. Teardown: Clean up any newly created project directories and ownership
    if _DATA_ROOT.exists():
        for d in list(_DATA_ROOT.iterdir()):
            if d.is_dir() and d.name not in PROTECTED_PROJECT_IDS and d.name not in initial_projects:
                delete_project(d.name)

    # 4. Teardown: Clean up any newly created users (cascades sessions via FK)
    try:
        with db_manager.session() as conn:
            current_users = conn.execute("SELECT id FROM users").fetchall()
            for r in current_users:
                if r["id"] not in initial_user_ids:
                    conn.execute("DELETE FROM users WHERE id = ?", (r["id"],))
    except Exception:
        pass
