from fastapi import APIRouter, HTTPException
import sqlite3

router = APIRouter(prefix="/users")

def get_db():
    conn = sqlite3.connect("test.db")
    return conn

@router.get("/search")
def search_user(username: str):
    conn = get_db()
    cursor = conn.cursor()
    
    # Vulnerable raw SQL f-string concatenation
    query = f"SELECT id, username, email FROM users WHERE username = '{username}'"
    cursor.execute(query)
    
    user = cursor.fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": user[0], "username": user[1], "email": user[2]}
