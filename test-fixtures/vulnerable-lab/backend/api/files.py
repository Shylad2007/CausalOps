from fastapi import APIRouter, HTTPException
import os

router = APIRouter(prefix="/files")

@router.get("/read")
def read_log_file(filename: str):
    """
    Reads application logs.
    Vulnerable to path traversal via unsanitized filename interpolation.
    """
    try:
        # Vulnerable open with user parameter
        with open(f"/var/log/app/{filename}", "r") as f:
            content = f.read()
        return {"filename": filename, "content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
