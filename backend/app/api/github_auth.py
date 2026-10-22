"""
backend/app/api/github_auth.py
Router for GitHub authentication, credential management, connection status,
and authorized repository discovery.
"""
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import httpx

from app.auth.dependencies import get_current_user, UserProfile
from app.services.credential_service import credential_service

router = APIRouter(prefix="/api/github", tags=["GitHub Authentication"])


class GitHubStatusResponse(BaseModel):
    connected: bool
    github_login: Optional[str] = None
    token_hint: Optional[str] = None
    scopes: List[str] = Field(default_factory=list)
    updated_at: Optional[float] = None
    message: Optional[str] = None


class GitHubConnectTokenRequest(BaseModel):
    token: str


class GitHubConnectResponse(BaseModel):
    connected: bool
    github_login: str
    token_hint: str
    scopes: List[str]
    updated_at: float
    message: str


class GitHubRepoItem(BaseModel):
    name: str
    full_name: str
    html_url: str
    default_branch: str = "main"
    private: bool = False
    description: Optional[str] = None


@router.get("/status", response_model=GitHubStatusResponse)
def get_github_connection_status(
    current_user: UserProfile = Depends(get_current_user),
):
    """
    Returns connection status and authorized metadata for the current user's GitHub integration.
    Never exposes raw tokens or secrets.
    """
    res = credential_service.get_github_status(current_user.id)
    return res


@router.post("/connect", response_model=GitHubConnectResponse)
def connect_github_token(
    req: GitHubConnectTokenRequest,
    current_user: UserProfile = Depends(get_current_user),
):
    """
    Validates token with GitHub, encrypts it at rest, and associates it with the authenticated user.
    """
    raw_token = req.token.strip()
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub Personal Access Token is required.",
        )

    try:
        saved = credential_service.save_github_token(
            user_id=current_user.id,
            username=current_user.username,
            raw_token=raw_token,
        )
        return saved
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to securely store GitHub credential: {str(e)}",
        )


@router.delete("/disconnect")
def disconnect_github(
    current_user: UserProfile = Depends(get_current_user),
):
    """
    Revokes and deletes the stored encrypted GitHub token for the current user.
    """
    deleted = credential_service.delete_github_token(current_user.id)
    return {
        "status": "disconnected",
        "deleted": deleted,
        "message": "GitHub connection has been severed and credentials deleted from secure storage.",
    }


@router.get("/repos", response_model=List[GitHubRepoItem])
def list_authorized_repositories(
    current_user: UserProfile = Depends(get_current_user),
):
    """
    Returns repositories accessible to the user's stored token to make connecting repos seamless.
    """
    token = credential_service.get_github_token(current_user.id)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub is not connected. Please connect your GitHub account first.",
        )

    api_headers = {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": f"Bearer {token}",
        "User-Agent": "CausalOps-AppSec-Platform/2.0",
    }

    try:
        with httpx.Client(timeout=15.0, follow_redirects=True) as client:
            resp = client.get("https://api.github.com/user/repos?per_page=30&sort=updated", headers=api_headers)
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"GitHub API returned error {resp.status_code} while listing repositories.",
                )
            items = []
            for r in resp.json():
                items.append(GitHubRepoItem(
                    name=r.get("name", ""),
                    full_name=r.get("full_name", ""),
                    html_url=r.get("html_url", ""),
                    default_branch=r.get("default_branch", "main"),
                    private=r.get("private", False),
                    description=r.get("description"),
                ))
            return items
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query GitHub repositories: {str(e)}",
        )
