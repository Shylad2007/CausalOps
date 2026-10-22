"""
backend/app/api/auth.py
FastAPI router for user registration, authentication, session check, and logout.
"""
from fastapi import APIRouter, HTTPException, Header, Depends
from typing import Optional
from app.auth.auth_service import (
    auth_service,
    UserRegisterRequest,
    UserLoginRequest,
    AuthResponse,
    UserProfile
)
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=AuthResponse)
def register_user(req: UserRegisterRequest):
    try:
        return auth_service.register(req.username, req.password, req.email)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.post("/login", response_model=AuthResponse)
def login_user(req: UserLoginRequest):
    try:
        return auth_service.login(req.username, req.password)
    except ValueError as ve:
        raise HTTPException(status_code=401, detail=str(ve))


@router.get("/me", response_model=UserProfile)
def get_me(current_user: UserProfile = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout_user(authorization: Optional[str] = Header(None)):
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        auth_service.revoke_token(token)
    return {"status": "logged_out", "message": "Session token successfully revoked."}
