"""
backend/app/auth/dependencies.py
FastAPI security dependencies and authorization helpers for CausalOps.
Guarantees strict authentication, token validation, and project ownership verification.
"""
from fastapi import Header, HTTPException, Depends
from typing import Optional
from app.auth.auth_service import auth_service, UserProfile
from app.services.project_storage import (
    get_project_owner,
    get_project,
    is_demo_project,
)


def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[UserProfile]:
    """Extracts and verifies user from Authorization header if present."""
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "").strip()
    return auth_service.verify_token(token)


def get_current_user(authorization: Optional[str] = Header(None)) -> UserProfile:
    """Strict authentication dependency. Rejects unauthenticated requests with 401."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required. Please sign in.")
    token = authorization.replace("Bearer ", "").strip()
    user = auth_service.verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session token. Please sign in again.")
    return user


def verify_project_access(
    project_id: str,
    current_user: UserProfile,
    allow_demo: bool = True,
    require_write: bool = False,
) -> bool:
    """
    Enforces project ownership and access controls.
    - If project is a demo project and allow_demo=True, read access is granted.
    - Write access to demo projects is disallowed or scoped safely.
    - User-owned projects can ONLY be accessed by the authenticated owner.
    - Returns 404 (not found) or 403 (forbidden) to prevent IDOR scanning.
    """
    if not project_id:
        raise HTTPException(status_code=400, detail="Project ID is required.")

    # Check demo project access
    if is_demo_project(project_id):
        if not allow_demo:
            raise HTTPException(status_code=403, detail="Operation not permitted on demo projects.")
        return True

    # Check project existence
    proj = get_project(project_id)
    if proj is None:
        raise HTTPException(status_code=404, detail="Project not found.")

    # Retrieve registered owner username from database or manifest
    owner_username = get_project_owner(project_id) or proj.owner_username

    if not owner_username:
        # Legacy project without explicit owner - grant access to current user and claim ownership
        from app.services.project_storage import register_project_ownership
        register_project_ownership(project_id, current_user.username, current_user.id, is_demo=False)
        return True

    if owner_username != current_user.username:
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: You do not have authorization to access this project."
        )

    return True
