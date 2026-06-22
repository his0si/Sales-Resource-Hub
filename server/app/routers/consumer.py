"""소비자 동향(consumer trends) 조회 라우터.

크롤링/분석 파이프라인이 채워 놓은 DB만 읽어 화면에 보여준다(LLM 직접 호출 없음).

데이터 출처:
- raw_consumer_trend : 셀인카페(self_in)·오늘의집(ohou) 원문 글
- consumer_product   : 글에서 추출한 한솔 제품 언급 + 감성(positive/negative/neutral)
- cp_briefing        : 제품별 소비자 브리핑(요약·긍/부정 피드백)
- consumer_briefing  : 주간 통합 브리핑(인테리어 이슈/타사 언급/한솔 보이스)
- product            : 제품 마스터(카테고리·제품명)

화면(client/src/pages/trends/*)이 쓰던 예시 데이터(data.ts)를 이 API 가 대체한다.
로그인한 앱 사용자(Bearer)만 접근 가능.
"""

import json

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app import db
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api", tags=["consumer"])

# 글 1건의 감성 = 채워진 컬럼 기준(positive→pos, negative→neg, 그 외→neu)
_SENT = """CASE
    WHEN cp.positive IS NOT NULL AND cp.positive <> '' THEN 'pos'
    WHEN cp.negative IS NOT NULL AND cp.negative <> '' THEN 'neg'
    ELSE 'neu' END"""

# 글(raw_consumer_trend) + 그 글의 제품 언급들을 한 행으로 묶는 기본 쿼리.
# content_id 로 조인해야 글-언급이 정확히 매칭된다(product_id 로 조인하면 엉뚱한 글이 붙음).
_POSTS_BASE = f"""
SELECT
    r.id, r.source, r.title, r.content, r.created_at, r.url, r.likes,
    COALESCE(
        json_agg(
            json_build_object(
                'product', cp.mentioned_name,
                'sentiment', {_SENT},
                'product_id', cp.product_id,
                'category', pr.category,
                'image', CASE
                    WHEN pr.image_data IS NOT NULL
                    THEN '/api/consumer/products/' || cp.product_id || '/image'
                    ELSE NULL END
            )
            ORDER BY cp.id
        ) FILTER (WHERE cp.id IS NOT NULL),
        '[]'
    )::text AS mentions
FROM raw_consumer_trend r
JOIN consumer_product cp
    ON cp.content_id = r.id AND cp.resolve_status = 'resolved'
LEFT JOIN product pr ON pr.id = cp.product_id
{{where}}
GROUP BY r.id
ORDER BY r.created_at DESC
{{limit}}
"""

# 제품 이미지는 product.image_data(bytea)에 적재돼 있고 아래 이미지 엔드포인트로 서빙한다.
# image_data 가 있는 제품만 URL 을 돌려준다(없으면 None → 화면은 스와치 색상 폴백).
def _image_url(product_id, has_image: bool) -> str | None:
    return f"/api/consumer/products/{product_id}/image" if has_image else None


# 제품명 → 결정적 파스텔 색상(스와치, 이미지 없을 때 폴백). 이름 해시로 생성.
def _swatch(name: str | None) -> str:
    if not name:
        return "#cfcabf"
    h = 0
    for ch in name:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    hue = h % 360
    return f"hsl({hue}, 28%, 72%)"


def _post(row) -> dict:
    d = dict(row)
    created = d.get("created_at")
    raw_m = d.get("mentions")
    mentions = json.loads(raw_m) if isinstance(raw_m, str) else (raw_m or [])
    return {
        "id": str(d["id"]),
        "channel": "O" if d.get("source") == "ohou" else "N",
        "title": d.get("title") or "",
        "date": created.strftime("%m.%d") if created else "",
        "likes": d.get("likes") or 0,
        "mentions": mentions,
        "body": d.get("content") or "",
        "url": d.get("url"),
    }


def _feedback(raw) -> list[dict]:
    """cp_briefing 의 positive/negative_feedback jsonb([{keyword,description}]) → [{chip,text}]."""
    arr = json.loads(raw) if isinstance(raw, str) else (raw or [])
    out = []
    for x in arr:
        if isinstance(x, dict):
            out.append({"chip": x.get("keyword") or "", "text": x.get("description") or ""})
    return out


async def _top_products(pool, limit: int = 10) -> list[dict]:
    """최근 7일 제품 언급량 Top N + 직전 7일 대비 증감(화살표/값)."""
    rows = await pool.fetch(
        """
        WITH this_week AS (
            SELECT product_id, count(*) AS n
            FROM consumer_product
            WHERE resolve_status = 'resolved'
              AND product_id IS NOT NULL
              AND created_at >= NOW() - INTERVAL '7 days'
            GROUP BY product_id
        ), prev_week AS (
            SELECT product_id, count(*) AS n
            FROM consumer_product
            WHERE resolve_status = 'resolved'
              AND product_id IS NOT NULL
              AND created_at >= NOW() - INTERVAL '14 days'
              AND created_at <  NOW() - INTERVAL '7 days'
            GROUP BY product_id
        )
        SELECT p.id, p.category, p.product_name AS name,
               t.n AS cur, COALESCE(pw.n, 0) AS prev
        FROM this_week t
        JOIN product p ON p.id = t.product_id
        LEFT JOIN prev_week pw ON pw.product_id = t.product_id
        ORDER BY t.n DESC, p.id
        LIMIT $1
        """,
        limit,
    )
    out = []
    for r in rows:
        delta = (r["cur"] or 0) - (r["prev"] or 0)
        trend = "up" if delta > 0 else "down" if delta < 0 else "flat"
        out.append(
            {
                "id": str(r["id"]),
                "category": r["category"],
                "name": r["name"],
                "trend": trend,
                "value": abs(delta),
            }
        )
    return out


@router.get("/consumer/overview")
async def consumer_overview(_user: dict = Depends(get_current_user)):
    """소비자 동향 메인: 주간 통합 브리핑 + 언급량 Top10 + 최근 게시글."""
    pool = db.get_pool()

    brief_row = await pool.fetchrow(
        """
        SELECT interior_issues, competitor_feedbacks, hansol_feedbacks, created_at
        FROM consumer_briefing
        ORDER BY created_at DESC
        LIMIT 1
        """
    )
    briefing = None
    if brief_row:
        briefing = {
            "interior_issues": brief_row["interior_issues"],
            "competitor_feedbacks": brief_row["competitor_feedbacks"],
            "hansol_feedbacks": brief_row["hansol_feedbacks"],
            "created_at": brief_row["created_at"].isoformat()
            if brief_row["created_at"]
            else None,
        }

    top10 = await _top_products(pool, 10)

    post_rows = await pool.fetch(_POSTS_BASE.format(where="", limit="LIMIT 5"))
    posts = [_post(r) for r in post_rows]

    return {"briefing": briefing, "top10": top10, "posts": posts}


@router.get("/consumer/posts")
async def consumer_posts(
    limit: int = Query(100, ge=1, le=500),
    _user: dict = Depends(get_current_user),
):
    """제품 언급이 있는 게시글 목록(최신순). 검색은 프론트에서 즉시 필터."""
    pool = db.get_pool()
    rows = await pool.fetch(_POSTS_BASE.format(where="", limit=f"LIMIT {int(limit)}"))
    return {"posts": [_post(r) for r in rows]}


@router.get("/consumer/posts/{post_id}")
async def consumer_post_detail(
    post_id: int,
    _user: dict = Depends(get_current_user),
):
    """게시글 1건 + 이전/다음 글(언급 있는 글 기준 최신순 이웃)."""
    pool = db.get_pool()
    rows = await pool.fetch(
        _POSTS_BASE.format(where="", limit="LIMIT 500")
    )
    posts = [_post(r) for r in rows]
    idx = next((i for i, p in enumerate(posts) if p["id"] == str(post_id)), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    prev_p = posts[idx - 1] if idx > 0 else None
    next_p = posts[idx + 1] if idx < len(posts) - 1 else None
    return {
        "post": posts[idx],
        "prev": {"id": prev_p["id"], "title": prev_p["title"]} if prev_p else None,
        "next": {"id": next_p["id"], "title": next_p["title"]} if next_p else None,
    }


@router.get("/consumer/products")
async def consumer_product_list(
    category: str | None = Query(None),
    subcategory: str | None = Query(None),
    q: str | None = Query(None),
    _user: dict = Depends(get_current_user),
):
    """제품 마스터(product) 목록 — 카테고리/하위카테고리/검색 필터."""
    pool = db.get_pool()

    cat_rows = await pool.fetch(
        "SELECT category, count(*) AS n FROM product WHERE category IS NOT NULL GROUP BY category ORDER BY n DESC"
    )
    categories = [c["category"] for c in cat_rows]
    selected = category if category in categories else (categories[0] if categories else None)

    sub_rows = await pool.fetch(
        "SELECT DISTINCT subcategory FROM product WHERE category = $1 AND subcategory IS NOT NULL ORDER BY 1",
        selected,
    )
    subcategories = ["전체"] + [s["subcategory"] for s in sub_rows]

    where = ["category = $1"]
    params: list = [selected]
    if subcategory and subcategory != "전체":
        params.append(subcategory)
        where.append(f"subcategory = ${len(params)}")
    if q and q.strip():
        params.append(f"%{q.strip()}%")
        where.append(f"product_name ILIKE ${len(params)}")

    rows = await pool.fetch(
        f"""
        SELECT id, category, subcategory, product_name,
               (image_data IS NOT NULL) AS has_image
        FROM product
        WHERE {' AND '.join(where)}
        ORDER BY id
        LIMIT 300
        """,
        *params,
    )
    products = [
        {
            "id": str(r["id"]),
            "category": r["category"],
            "subcategory": r["subcategory"],
            "name": r["product_name"],
            "image": _image_url(r["id"], r["has_image"]),
            "swatch": _swatch(r["product_name"]),
        }
        for r in rows
    ]
    return {
        "categories": categories,
        "subcategories": subcategories,
        "selected": selected,
        "products": products,
    }


@router.get("/consumer/products/{product_id}/image")
async def consumer_product_image(product_id: int):
    """제품 이미지(product.image_data, jpeg)를 그대로 서빙.

    <img src> 는 Authorization 헤더를 못 실으므로 이 엔드포인트만 인증을 두지 않는다
    (제품 카탈로그 이미지라 민감도 낮음). 브라우저 캐시로 반복 요청을 줄인다.
    """
    pool = db.get_pool()
    data = await pool.fetchval(
        "SELECT image_data FROM product WHERE id = $1", product_id
    )
    if not data:
        raise HTTPException(status_code=404, detail="이미지가 없습니다.")
    return Response(
        content=bytes(data),
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/consumer/products/{product_id}")
async def consumer_product_detail(
    product_id: int,
    _user: dict = Depends(get_current_user),
):
    """제품 상세: 마스터 정보 + 최신 브리핑(요약·긍/부정) + 순위·언급수 + 관련 게시글."""
    pool = db.get_pool()

    prod = await pool.fetchrow(
        """
        SELECT id, category, subcategory, product_name,
               (image_data IS NOT NULL) AS has_image
        FROM product WHERE id = $1
        """,
        product_id,
    )
    if not prod:
        raise HTTPException(status_code=404, detail="제품을 찾을 수 없습니다.")

    brief = await pool.fetchrow(
        """
        SELECT overall_summary, mention_count, positive_feedback, negative_feedback
        FROM cp_briefing
        WHERE product_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        """,
        product_id,
    )

    week_count = await pool.fetchval(
        """
        SELECT count(*) FROM consumer_product
        WHERE product_id = $1 AND resolve_status = 'resolved'
          AND created_at >= NOW() - INTERVAL '7 days'
        """,
        product_id,
    )
    rank = None
    if week_count:
        rank = await pool.fetchval(
            """
            SELECT 1 + count(*) FROM (
                SELECT product_id, count(*) AS n
                FROM consumer_product
                WHERE resolve_status = 'resolved' AND product_id IS NOT NULL
                  AND created_at >= NOW() - INTERVAL '7 days'
                GROUP BY product_id
                HAVING count(*) > $1
            ) s
            """,
            week_count,
        )

    mention_count = (brief["mention_count"] if brief and brief["mention_count"] else week_count) or 0
    if rank and mention_count:
        stat = f"최근 7일 {rank}위 · 언급 {mention_count}건"
    elif mention_count:
        stat = f"최근 7일 · 언급 {mention_count}건"
    else:
        stat = "최근 7일 언급 없음"

    related_rows = await pool.fetch(
        _POSTS_BASE.format(
            where="WHERE r.id IN (SELECT content_id FROM consumer_product "
            "WHERE product_id = $1 AND resolve_status = 'resolved')",
            limit="LIMIT 50",
        ),
        product_id,
    )

    return {
        "product": {
            "id": str(prod["id"]),
            "category": prod["category"],
            "subcategory": prod["subcategory"],
            "name": prod["product_name"],
            "image": _image_url(prod["id"], prod["has_image"]),
            "swatch": _swatch(prod["product_name"]),
        },
        "stat": stat,
        "aiBriefing": (brief["overall_summary"] if brief else "") or "",
        "positive": _feedback(brief["positive_feedback"]) if brief else [],
        "negative": _feedback(brief["negative_feedback"]) if brief else [],
        "competitors": [],  # 타사 비교 데이터는 아직 파이프라인에 없음
        "posts": [_post(r) for r in related_rows],
    }
