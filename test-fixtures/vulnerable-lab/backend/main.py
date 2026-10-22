from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api.users import router as users_router
from backend.api.files import router as files_router

app = FastAPI(title="Vulnerable Test Lab")

# Insecure CORS configuration: Wildcard origin with credentials allowed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users_router)
app.include_router(files_router)
