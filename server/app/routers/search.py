"""통합 검색(/api/search) 라우터.

상단바 '제품·뉴스·메모 통합 검색'을 위해 네 갈래(뉴스/제품/게시글/세일즈 메모)를
각 원본 테이블에서 ILIKE 로 한 번에 조회해 그룹별 상위 N건을 돌려준다.
저장된 실데이터만 읽으며 LLM 호출은 없다. 로그인한 앱 사용자(Bearer)만 접근 가능.
"""

from fastapi import APIRouter, Depends, Query

from app import db, sales_memo_ai
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api", tags=["search"])

# 그룹별 최대 노출 건수
_PER_GROUP = 6


def _memo_title(row: dict) -> str:
    """세일즈 메모 제목: AI 제목 우선, 없으면 거래처/활동계획 첫 줄 폴백 (보드와 동일 규칙)."""
    title = sales_memo_ai.clean_title(row.get("ai_title"))
    if title:
        return title
    customer = (row.get("customer_name") or "").strip()
    plan = (row.get("activity_plan") or "").strip().splitlines()
    head = sales_memo_ai.clean_title(plan[0]) if plan else ""
    if customer and head:
        return f"{customer}, {head}"
    return customer or head or "(제목 없음)"


@router.get("/search")
async def unified_search(
    q: str = Query("", description="검색어"),
    _user: dict = Depends(get_current_user),
):
    """뉴스/제품/게시글/세일즈 메모를 가로질러 검색해 그룹별 상위 결과를 반환."""
    q = (q or "").strip()
    if not q:
        return {"q": "", "total": 0, "news": [], "products": [], "posts": [], "memos": []}

    pool = db.get_pool()
    like = f"%{q}%"

    news_rows = await pool.fetch(
        """
        SELECT id, title, description, search_query, naverlink, originallink, collected_at_kst
        FROM working_news_articles
        WHERE is_active = TRUE AND (title ILIKE $1 OR description ILIKE $1)
        ORDER BY published_at_kst DESC NULLS LAST, id DESC
        LIMIT $2
        """,
        like,
        _PER_GROUP,
    )
    product_rows = await pool.fetch(
        """
        SELECT id, product_name, category, (image_data IS NOT NULL) AS has_image
        FROM product
        WHERE product_name ILIKE $1
        ORDER BY id
        LIMIT $2
        """,
        like,
        _PER_GROUP,
    )
    post_rows = await pool.fetch(
        """
        SELECT id, title, source, created_at
        FROM raw_consumer_trend
        WHERE title ILIKE $1 OR content ILIKE $1
        ORDER BY created_at DESC NULLS LAST, id DESC
        LIMIT $2
        """,
        like,
        _PER_GROUP,
    )
    memo_rows = await pool.fetch(
        """
        SELECT id, customer_name, ai_title, activity_plan, author_name, written_at, visit_date
        FROM sales_memo
        WHERE customer_name ILIKE $1 OR ai_title ILIKE $1 OR activity_plan ILIKE $1
           OR strategy ILIKE $1 OR operation ILIKE $1 OR product ILIKE $1 OR takeaway ILIKE $1
        ORDER BY written_at DESC NULLS LAST, visit_date DESC NULLS LAST, id DESC
        LIMIT $2
        """,
        like,
        _PER_GROUP,
    )

    news = [
        {
            "id": r["id"],
            "title": r["title"],
            "description": r["description"],
            "company": r["search_query"],
            "link": r["naverlink"] or r["originallink"],
            "date": r["collected_at_kst"].strftime("%m.%d") if r["collected_at_kst"] else "",
        }
        for r in news_rows
    ]
    products = [
        {
            "id": str(r["id"]),
            "name": r["product_name"],
            "category": r["category"],
            "image": f"/api/consumer/products/{r['id']}/image" if r["has_image"] else None,
        }
        for r in product_rows
    ]
    posts = [
        {
            "id": str(r["id"]),
            "title": r["title"] or "",
            "channel": "O" if r["source"] == "ohou" else "N",
            "date": r["created_at"].strftime("%m.%d") if r["created_at"] else "",
        }
        for r in post_rows
    ]
    memos = [
        {
            "id": r["id"],
            "title": _memo_title(dict(r)),
            "customer": (r["customer_name"] or "").strip() or None,
            "author": r["author_name"] or "",
            "date": (r["written_at"] or r["visit_date"]).strftime("%m.%d")
            if (r["written_at"] or r["visit_date"])
            else "",
        }
        for r in memo_rows
    ]

    total = len(news) + len(products) + len(posts) + len(memos)
    return {"q": q, "total": total, "news": news, "products": products, "posts": posts, "memos": memos}
