from fastapi import APIRouter, HTTPException

from app import db

router = APIRouter(prefix="/api", tags=["db"])


@router.get("/db-health")
async def db_health():
    """DB 연결 확인용. SELECT 1 결과를 돌려준다."""
    if db.pool is None:
        raise HTTPException(status_code=503, detail="DB 미연결 (DATABASE_URL 미설정 또는 연결 실패)")
    value = await db.pool.fetchval("SELECT 1")
    return {"db": "ok", "result": value}


@router.get("/users")
async def list_users():
    """users 테이블 조회 (비밀번호는 노출하지 않음)."""
    pool = db.get_pool()
    rows = await pool.fetch(
        "SELECT id, email, is_verified, created_at FROM users ORDER BY id"
    )
    return [dict(row) for row in rows]
