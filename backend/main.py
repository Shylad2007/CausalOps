"""
CausalOps Backend Application Entrypoint
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(
    title="CausalOps API",
    description="Causal Intelligence Engine for Incident Reconstruction and Counterfactual Investigation",
    version="0.1.0"
)

# CORS setup for frontend local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.scenarios import router as scenarios_router
from app.api.codebase import router as codebase_router
from app.api.auth import router as auth_router
from app.api.github_auth import router as github_auth_router

app.include_router(scenarios_router)
app.include_router(codebase_router)
app.include_router(auth_router)
app.include_router(github_auth_router)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "version": "0.1.0",
        "ai_status": "mock_fallback" if not os.environ.get("GEMMA_API_KEY") else "ready"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
