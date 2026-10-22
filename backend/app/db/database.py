"""
backend/app/db/database.py
Robust SQLite database manager with schema versioning and migrations.
Uses Python's standard sqlite3 library (no heavy ORM dependencies required).
"""
import os
import sqlite3
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any, Callable
from contextlib import contextmanager

logger = logging.getLogger("CausalOps.Database")

DATA_DIR = Path(__file__).parent.parent.parent / "data"
DB_PATH = DATA_DIR / "causalops.db"

MIGRATIONS: List[Dict[str, Any]] = [
    {
        "version": 1,
        "name": "001_initial_auth_and_ownership",
        "sql": """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_sessions (
            id TEXT PRIMARY KEY,
            token_hash TEXT UNIQUE NOT NULL,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL,
            created_at REAL NOT NULL,
            expires_at REAL NOT NULL,
            revoked INTEGER DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS project_ownership (
            project_id TEXT PRIMARY KEY,
            owner_username TEXT NOT NULL,
            owner_user_id TEXT,
            is_demo INTEGER DEFAULT 0,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON user_sessions(token_hash);
        CREATE INDEX IF NOT EXISTS idx_project_owner ON project_ownership(owner_username);
        """
    },
    {
        "version": 2,
        "name": "002_github_credentials_and_tokens",
        "sql": """
        CREATE TABLE IF NOT EXISTS github_credentials (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL UNIQUE,
            username TEXT NOT NULL,
            encrypted_token TEXT NOT NULL,
            token_hint TEXT NOT NULL,
            scopes TEXT,
            github_login TEXT,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_github_creds_user ON github_credentials(user_id);
        CREATE INDEX IF NOT EXISTS idx_github_creds_username ON github_credentials(username);
        """
    }
]


class DatabaseManager:
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=30.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        return conn

    @contextmanager
    def session(self):
        conn = self.get_connection()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self):
        """Runs pending schema migrations automatically."""
        with self.session() as conn:
            conn.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            cursor = conn.cursor()
            cursor.execute("SELECT version FROM schema_migrations")
            applied = {row["version"] for row in cursor.fetchall()}

            for migration in MIGRATIONS:
                v = migration["version"]
                if v not in applied:
                    logger.info(f"Applying migration v{v}: {migration['name']}")
                    conn.executescript(migration["sql"])
                    conn.execute(
                        "INSERT INTO schema_migrations (version, name) VALUES (?, ?)",
                        (v, migration["name"])
                    )

db_manager = DatabaseManager()
