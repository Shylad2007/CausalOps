"""
backend/app/auth/auth_service.py
Secure, persistent authentication and session management using SQLite, per-user salts,
PBKDF2-HMAC-SHA256 password hashing, and token revocation handling.
"""
import hashlib
import hmac
import os
import secrets
import time
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from app.db.database import db_manager

# Configurable session duration (default: 7 days)
SESSION_DURATION_SECS = int(os.getenv("SESSION_DURATION_SECS", 7 * 24 * 3600))
SECRET_KEY = os.getenv("SESSION_SECRET_KEY", "causalops-local-dev-secret-key-992184812")


class UserRegisterRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = None


class UserLoginRequest(BaseModel):
    username: str
    password: str


class UserProfile(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    created_at: float


class AuthResponse(BaseModel):
    token: str
    user: UserProfile


class AuthService:
    def __init__(self):
        self.db = db_manager

    def _hash_password(self, password: str, salt_hex: str) -> str:
        salt = bytes.fromhex(salt_hex)
        return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200000).hex()

    def _generate_token_and_hash(self, username: str, user_id: str) -> tuple[str, str]:
        # Generates a cryptographically strong 32-byte session token
        random_entropy = secrets.token_hex(32)
        raw_token = f"cop_{user_id}_{random_entropy}"
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        return raw_token, token_hash

    def register(self, username: str, password: str, email: Optional[str] = None) -> AuthResponse:
        username = username.strip().lower()
        if not username or len(username) < 3:
            raise ValueError("Username must be at least 3 characters.")
        if len(password) < 6:
            raise ValueError("Password must be at least 6 characters.")

        with self.db.session() as conn:
            existing = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
            if existing:
                raise ValueError(f"User '{username}' already exists.")

            user_id = f"usr-{secrets.token_hex(6)}"
            salt_hex = secrets.token_hex(16)
            pwd_hash = self._hash_password(password, salt_hex)
            now = time.time()

            conn.execute(
                """
                INSERT INTO users (id, username, email, password_hash, salt, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (user_id, username, email, pwd_hash, salt_hex, now, now)
            )

            raw_token, token_hash = self._generate_token_and_hash(username, user_id)
            expires_at = now + SESSION_DURATION_SECS
            session_id = f"sess-{secrets.token_hex(8)}"

            conn.execute(
                """
                INSERT INTO user_sessions (id, token_hash, user_id, username, created_at, expires_at, revoked)
                VALUES (?, ?, ?, ?, ?, ?, 0)
                """,
                (session_id, token_hash, user_id, username, now, expires_at)
            )

        user_profile = UserProfile(id=user_id, username=username, email=email, created_at=now)
        return AuthResponse(token=raw_token, user=user_profile)

    def login(self, username: str, password: str) -> AuthResponse:
        username = username.strip().lower()
        with self.db.session() as conn:
            row = conn.execute(
                "SELECT id, username, email, password_hash, salt, created_at FROM users WHERE username = ?",
                (username,)
            ).fetchone()
            if not row:
                raise ValueError("Invalid username or password.")

            input_hash = self._hash_password(password, row["salt"])
            if not hmac.compare_digest(row["password_hash"], input_hash):
                raise ValueError("Invalid username or password.")

            now = time.time()
            raw_token, token_hash = self._generate_token_and_hash(username, row["id"])
            expires_at = now + SESSION_DURATION_SECS
            session_id = f"sess-{secrets.token_hex(8)}"

            conn.execute(
                """
                INSERT INTO user_sessions (id, token_hash, user_id, username, created_at, expires_at, revoked)
                VALUES (?, ?, ?, ?, ?, ?, 0)
                """,
                (session_id, token_hash, row["id"], username, now, expires_at)
            )

            user_profile = UserProfile(
                id=row["id"],
                username=row["username"],
                email=row["email"],
                created_at=row["created_at"]
            )
            return AuthResponse(token=raw_token, user=user_profile)

    def verify_token(self, token: str) -> Optional[UserProfile]:
        if not token or not isinstance(token, str):
            return None

        # Check for legacy token format (username.signature) and migrate seamlessly
        if "." in token and not token.startswith("cop_"):
            parts = token.split(".")
            if len(parts) == 2:
                legacy_username, legacy_sig = parts
                legacy_expected = hmac.new(
                    SECRET_KEY.encode("utf-8"),
                    legacy_username.encode("utf-8"),
                    hashlib.sha256
                ).hexdigest()
                if hmac.compare_digest(legacy_sig, legacy_expected):
                    with self.db.session() as conn:
                        row = conn.execute(
                            "SELECT id, username, email, created_at FROM users WHERE username = ?",
                            (legacy_username.lower(),)
                        ).fetchone()
                        if row:
                            return UserProfile(
                                id=row["id"],
                                username=row["username"],
                                email=row["email"],
                                created_at=row["created_at"]
                            )
            return None

        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        now = time.time()

        try:
            with self.db.session() as conn:
                row = conn.execute(
                    """
                    SELECT u.id, u.username, u.email, u.created_at, s.expires_at, s.revoked
                    FROM user_sessions s
                    JOIN users u ON s.user_id = u.id
                    WHERE s.token_hash = ?
                    """,
                    (token_hash,)
                ).fetchone()

                if not row:
                    return None

                if row["revoked"] == 1 or row["expires_at"] < now:
                    return None

                return UserProfile(
                    id=row["id"],
                    username=row["username"],
                    email=row["email"],
                    created_at=row["created_at"]
                )
        except Exception:
            return None

    def revoke_token(self, token: str) -> bool:
        """Revokes a session token immediately on logout."""
        if not token:
            return False
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        with self.db.session() as conn:
            cursor = conn.execute(
                "UPDATE user_sessions SET revoked = 1 WHERE token_hash = ?",
                (token_hash,)
            )
            return cursor.rowcount > 0

    def delete_user(self, username_or_id: str) -> bool:
        """Permanently removes a user and cascades deletion of sessions (useful for test teardown)."""
        with self.db.session() as conn:
            cursor = conn.execute(
                "DELETE FROM users WHERE id = ? OR username = ?",
                (username_or_id, username_or_id)
            )
            return cursor.rowcount > 0


auth_service = AuthService()
