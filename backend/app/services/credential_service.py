"""
backend/app/services/credential_service.py
Secure, encrypted-at-rest credential storage and management for GitHub integrations.
Uses Fernet (AES-128-CBC + HMAC-SHA256 authenticated symmetric encryption).
Keys are managed server-side and never exposed to clients, logs, or API responses.
"""
import os
import time
import uuid
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
import httpx
from cryptography.fernet import Fernet, InvalidToken

from app.db.database import db_manager

logger = logging.getLogger("CausalOps.CredentialService")

ENV_PATH = Path(__file__).parent.parent.parent / ".env"


class CredentialService:
    def __init__(self):
        self.db = db_manager
        self._fernet: Optional[Fernet] = None

    def _get_fernet(self) -> Fernet:
        """
        Initializes and caches the Fernet encryption cipher using CREDENTIAL_ENCRYPTION_KEY.
        If the key is not set in environment or backend/.env, automatically generates
        and securely persists a new key in backend/.env.
        """
        if self._fernet is not None:
            return self._fernet

        key = os.getenv("CREDENTIAL_ENCRYPTION_KEY")
        if not key or not key.strip():
            # Check backend/.env
            if ENV_PATH.exists():
                try:
                    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
                        line = line.strip()
                        if line.startswith("CREDENTIAL_ENCRYPTION_KEY=") and not line.startswith("#"):
                            val = line.split("=", 1)[1].strip().strip('"').strip("'")
                            if val:
                                key = val
                                break
                except Exception as e:
                    logger.warning(f"Error reading .env for encryption key: {e}")

        if not key or not key.strip():
            # Auto-generate a fresh Fernet key and save to .env
            new_key = Fernet.generate_key().decode("utf-8")
            try:
                if ENV_PATH.exists():
                    current_content = ENV_PATH.read_text(encoding="utf-8")
                    if "CREDENTIAL_ENCRYPTION_KEY" not in current_content:
                        separator = "\n" if not current_content.endswith("\n") else ""
                        ENV_PATH.write_text(
                            f"{current_content}{separator}CREDENTIAL_ENCRYPTION_KEY=\"{new_key}\"\n",
                            encoding="utf-8",
                        )
                else:
                    ENV_PATH.write_text(f"CREDENTIAL_ENCRYPTION_KEY=\"{new_key}\"\n", encoding="utf-8")
                os.environ["CREDENTIAL_ENCRYPTION_KEY"] = new_key
                key = new_key
                logger.info("Generated and persisted new CREDENTIAL_ENCRYPTION_KEY in backend/.env")
            except Exception as e:
                logger.warning(f"Failed to persist CREDENTIAL_ENCRYPTION_KEY to .env: {e}")
                key = new_key

        try:
            self._fernet = Fernet(key.encode("utf-8") if isinstance(key, str) else key)
            return self._fernet
        except Exception as e:
            # If provided key is invalid, generate an ephemeral valid key to prevent crashing
            logger.error(f"Invalid CREDENTIAL_ENCRYPTION_KEY format ({e}). Generating fallback key.")
            fallback_key = Fernet.generate_key()
            self._fernet = Fernet(fallback_key)
            return self._fernet

    def encrypt_secret(self, plaintext: str) -> str:
        """Encrypts plaintext string to URL-safe base64 ciphertext string."""
        fernet = self._get_fernet()
        return fernet.encrypt(plaintext.encode("utf-8")).decode("utf-8")

    def decrypt_secret(self, ciphertext: str) -> Optional[str]:
        """Decrypts ciphertext string to plaintext string, returning None on failure."""
        try:
            fernet = self._get_fernet()
            return fernet.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
        except (InvalidToken, Exception) as e:
            logger.warning(f"Decryption failed: {e}")
            return None

    def validate_github_token_with_api(
        self,
        raw_token: str,
        custom_client: Optional[httpx.Client] = None,
    ) -> Dict[str, Any]:
        """
        Validates GitHub personal access token by querying GitHub user endpoint.
        Returns dict with login, scopes, and user metadata.
        Raises ValueError if token is invalid or unauthorized.
        """
        token = raw_token.strip()
        if not token:
            raise ValueError("Token must not be empty.")

        api_headers = {
            "Accept": "application/vnd.github.v3+json",
            "Authorization": f"Bearer {token}",
            "User-Agent": "CausalOps-AppSec-Platform/2.0",
        }

        client = custom_client or httpx.Client(timeout=15.0, follow_redirects=True)
        try:
            resp = client.get("https://api.github.com/user", headers=api_headers)
            if resp.status_code == 401:
                raise ValueError("Invalid GitHub personal access token: authentication failed (401 Unauthorized).")
            if resp.status_code == 403:
                raise ValueError("GitHub API access forbidden (403). Check token permissions and rate limits.")
            if resp.status_code != 200:
                raise ValueError(f"GitHub returned HTTP status {resp.status_code} while validating token.")

            user_data = resp.json()
            scopes_header = resp.headers.get("X-OAuth-Scopes", "")
            scopes = [s.strip() for s in scopes_header.split(",") if s.strip()]

            return {
                "github_login": user_data.get("login") or "github_user",
                "scopes": scopes,
                "name": user_data.get("name"),
                "avatar_url": user_data.get("avatar_url"),
            }
        finally:
            if custom_client is None:
                client.close()

    def save_github_token(
        self,
        user_id: str,
        username: str,
        raw_token: str,
        custom_client: Optional[httpx.Client] = None,
    ) -> Dict[str, Any]:
        """
        Validates, encrypts, and stores a user's GitHub Personal Access Token.
        Returns public connection status metadata without exposing the raw token.
        """
        token = raw_token.strip()
        if len(token) < 8:
            raise ValueError("Invalid GitHub token length. A valid GitHub personal access token is required.")

        # 1. Validate with GitHub API
        validation = self.validate_github_token_with_api(token, custom_client=custom_client)
        github_login = validation["github_login"]
        scopes_list = validation["scopes"]
        scopes_str = ",".join(scopes_list)

        # 2. Compute safe display hint (never exposes > 4 chars)
        token_hint = f"...{token[-4:]}"
        if token.startswith("ghp_"):
            token_hint = f"ghp_...{token[-4:]}"
        elif token.startswith("github_pat_"):
            token_hint = f"github_pat_...{token[-4:]}"

        # 3. Encrypt at rest
        encrypted = self.encrypt_secret(token)
        now = time.time()
        record_id = f"ghc-{uuid.uuid4().hex[:12]}"

        # 4. Upsert into database
        with self.db.session() as conn:
            conn.execute(
                """
                INSERT INTO github_credentials (
                    id, user_id, username, encrypted_token, token_hint, scopes, github_login, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    encrypted_token = excluded.encrypted_token,
                    token_hint = excluded.token_hint,
                    scopes = excluded.scopes,
                    github_login = excluded.github_login,
                    username = excluded.username,
                    updated_at = excluded.updated_at
                """,
                (record_id, user_id, username, encrypted, token_hint, scopes_str, github_login, now, now),
            )

        return {
            "connected": True,
            "github_login": github_login,
            "token_hint": token_hint,
            "scopes": scopes_list,
            "updated_at": now,
            "message": f"Successfully authorized and connected GitHub account @{github_login}.",
        }

    def get_github_token(self, user_id: str) -> Optional[str]:
        """
        Retrieves and decrypts the GitHub Personal Access Token for user_id.
        Internal backend use only.
        """
        if not user_id:
            return None
        with self.db.session() as conn:
            row = conn.execute(
                "SELECT encrypted_token FROM github_credentials WHERE user_id = ?",
                (user_id,),
            ).fetchone()
            if not row or not row["encrypted_token"]:
                return None
            return self.decrypt_secret(row["encrypted_token"])

    def get_github_token_by_username(self, username: str) -> Optional[str]:
        """
        Retrieves and decrypts the GitHub Personal Access Token for username.
        Internal backend use only.
        """
        if not username:
            return None
        with self.db.session() as conn:
            row = conn.execute(
                "SELECT encrypted_token FROM github_credentials WHERE username = ?",
                (username.strip().lower(),),
            ).fetchone()
            if not row or not row["encrypted_token"]:
                return None
            return self.decrypt_secret(row["encrypted_token"])

    def get_github_status(self, user_id: str) -> Dict[str, Any]:
        """
        Returns safe connection status metadata for current user.
        Never returns raw tokens.
        """
        if not user_id:
            return {
                "connected": False,
                "github_login": None,
                "token_hint": None,
                "scopes": [],
                "updated_at": None,
            }

        with self.db.session() as conn:
            row = conn.execute(
                "SELECT github_login, token_hint, scopes, updated_at FROM github_credentials WHERE user_id = ?",
                (user_id,),
            ).fetchone()

            if not row:
                return {
                    "connected": False,
                    "github_login": None,
                    "token_hint": None,
                    "scopes": [],
                    "updated_at": None,
                }

            scopes_list = [s.strip() for s in row["scopes"].split(",") if s.strip()] if row["scopes"] else []
            return {
                "connected": True,
                "github_login": row["github_login"],
                "token_hint": row["token_hint"],
                "scopes": scopes_list,
                "updated_at": row["updated_at"],
            }

    def delete_github_token(self, user_id: str) -> bool:
        """Revokes and permanently removes stored GitHub credentials for user_id."""
        if not user_id:
            return False
        with self.db.session() as conn:
            cursor = conn.execute(
                "DELETE FROM github_credentials WHERE user_id = ?",
                (user_id,),
            )
            return cursor.rowcount > 0


credential_service = CredentialService()
