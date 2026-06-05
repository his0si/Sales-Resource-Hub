"""영업일지(sales_memo) 조회 라우터.

Gmail 로 들어온 [HSP SalesMemo] 메일은 폴러(sales_memo_sync)가 DB 에 적재하므로,
화면은 Gmail 을 직접 보지 않고 이 테이블만 최신순으로 읽어 보여준다.
로그인한 앱 사용자(Bearer)만 접근 가능.
"""

from fastapi import APIRouter, Depends, Query

from app import db
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api", tags=["sales-memo"])

# 화면 표 렌더링에 필요한 컬럼들 (작성일/방문일 최신순 정렬)
_FIELDS = """
    id, visit_no, customer_name, customer_code,
    author_name, author_emp_no,
    planned_visit_date, visit_date, written_at,
    activity_plan, strategy, operation, product, personal, takeaway, followup_plan,
    gmail_id
"""


@router.get("/sales-memo")
async def list_sales_memo(
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    _user: dict = Depends(get_current_user),
):
    """영업일지 전체를 최신순(작성일 → 방문일 → id)으로 반환."""
    pool = db.get_pool()
    rows = await pool.fetch(
        f"""
        SELECT {_FIELDS}
        FROM sales_memo
        ORDER BY written_at DESC NULLS LAST,
                 visit_date DESC NULLS LAST,
                 id DESC
        LIMIT $1 OFFSET $2
        """,
        limit,
        offset,
    )
    total = await pool.fetchval("SELECT count(*) FROM sales_memo")
    return {"count": len(rows), "total": total, "memos": [dict(r) for r in rows]}
