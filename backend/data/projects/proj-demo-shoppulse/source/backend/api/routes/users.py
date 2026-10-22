from fastapi import APIRouter, Depends
router = APIRouter()

@router.get('/search')
def search_users(search_query: str):
    # User search query execution
    query = f"SELECT * FROM users WHERE username = '{search_query}'"
    cursor.execute(query)
    results = cursor.fetchall()
    return {'results': results}
