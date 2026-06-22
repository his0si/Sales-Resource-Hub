"""뉴스(working_news_articles) 조회 라우터.

네이버 뉴스 API → 수집·필터링·카테고리 분류 파이프라인이 채워 놓은
working_news_articles 테이블만 읽어 화면에 보여준다(LLM 직접 호출 없음).

화면 규칙:
- is_active = TRUE 인 기사(= relevance_label 'related', 카테고리 분류 완료)만 노출
- 회사(경쟁사) 필터: 테이블에 회사 컬럼이 없으므로 search_query 로 유도한다.
- 유형 필터: primary_category / secondary_category (없으면 1개, 있으면 2개)
- 정렬 기본값은 relevance(관련도) — 아무 필터/정렬도 고르지 않았을 때
- 원문 링크는 originallink(없으면 naverlink), '마지막 업데이트'는 collected_at_kst
로그인한 앱 사용자(Bearer)만 접근 가능.
"""

from fastapi import APIRouter, Depends, Query

from app import db
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api", tags=["news"])

# search_query 가 곧 '회사명'인 검색어들(자사·경쟁사). 노출/정렬 순서도 이 순서를 따른다.
# 그 외 주제성 검색어(바닥재·세라믹 상판 등)는 모두 '기타'로 묶는다.
_COMPANY_QUERIES = [
    "한솔홈데코",
    "LX하우시스",
    "KCC",
    "KCC글라스",  # KCC 검색어를 'KCC글라스'로 변형 예정 — 둘 다 회사로 인식
    "동화자연마루",
    "구정마루",
    "예림",
    "영림",
]
_OTHER = "기타"

# 2단계 카테고리(유형) 고정 순서 — 필터 칩 노출 순서와 동일하게 맞춘다.
_CATEGORIES = [
    "신제품/MOU",
    "시장동향/건설경기",
    "경영/재무",
    "친환경/ESG",
    "유통/채널",
    "기타",
]

# 화면 카드 렌더링에 필요한 컬럼들
_FIELDS = """
    id, search_query, title, description,
    originallink, naverlink,
    primary_category, secondary_category,
    relevance_confidence,
    collected_at_kst, published_at_kst
"""


def _company_of(search_query: str | None) -> str:
    """search_query → 회사명. 회사 검색어면 그대로, 주제 검색어면 '기타'."""
    return search_query if search_query in _COMPANY_QUERIES else _OTHER


def _news_item(row: dict) -> dict:
    """DB 행을 화면 카드용 dict 로 가공."""
    primary = row.get("primary_category")
    secondary = row.get("secondary_category")
    # 유형: primary 우선, secondary 가 있으면 둘 다(중복은 제거)
    types = [c for c in (primary, secondary) if c]
    if len(types) == 2 and types[0] == types[1]:
        types = types[:1]
    return {
        "id": row["id"],
        "company": _company_of(row.get("search_query")),
        "title": row.get("title"),
        "description": row.get("description"),
        # 원문 링크: 언론사 원본(originallink) 우선, 없으면 네이버 링크
        # 원문 링크: 가독성 좋은 네이버 링크 우선(네이버 링크가 없으면 originallink 에
        # 네이버 링크가 들어오는 구조), 그래도 없으면 originallink 폴백
        "link": row.get("naverlink") or row.get("originallink"),
        "types": types,
        "confidence": (
            float(row["relevance_confidence"])
            if row.get("relevance_confidence") is not None
            else None
        ),
        # 마지막 업데이트 = 수집 시각(KST)
        "collected_at": row.get("collected_at_kst"),
        "published_at": row.get("published_at_kst"),
    }


@router.get("/news")
async def list_news(
    company: str | None = Query(None, description="회사 필터(미지정=전체)"),
    category: str | None = Query(None, description="유형 필터(primary/secondary 둘 중 하나라도 일치)"),
    q: str | None = Query(None, description="제목·본문 검색어"),
    sort: str = Query(
        "published",
        description="published(발행 최신순·기본) | relevance(관련도순) | collected(수집 최신순)",
    ),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    _user: dict = Depends(get_current_user),
):
    """활성 뉴스 기사 목록 + 필터 칩 구성용 회사/유형 목록을 반환."""
    pool = db.get_pool()

    # ---- WHERE 절 동적 구성 (is_active 는 항상 고정) ----
    where = ["is_active = TRUE"]
    params: list = []

    if company and company != _OTHER:
        params.append(company)
        where.append(f"search_query = ${len(params)}")
    elif company == _OTHER:
        # '기타' = 회사 검색어가 아닌 주제성 기사
        params.append(_COMPANY_QUERIES)
        where.append(f"search_query <> ALL(${len(params)}::text[])")

    if category in _CATEGORIES:
        params.append(category)
        where.append(
            f"(primary_category = ${len(params)} OR secondary_category = ${len(params)})"
        )

    if q and q.strip():
        params.append(f"%{q.strip()}%")
        where.append(f"(title ILIKE ${len(params)} OR description ILIKE ${len(params)})")

    where_sql = " AND ".join(where)

    # ---- 정렬 ----
    #  published(기본): 발행 최신순  /  relevance: 관련도순  /  collected: 수집 최신순
    if sort == "relevance":
        order_sql = (
            "relevance_confidence DESC NULLS LAST, "
            "published_at_kst DESC NULLS LAST, id DESC"
        )
    elif sort == "collected":
        order_sql = "collected_at_kst DESC NULLS LAST, id DESC"
    else:  # published (기본)
        order_sql = "published_at_kst DESC NULLS LAST, id DESC"

    params.append(limit)
    limit_idx = len(params)
    params.append(offset)
    offset_idx = len(params)

    rows = await pool.fetch(
        f"""
        SELECT {_FIELDS}
        FROM working_news_articles
        WHERE {where_sql}
        ORDER BY {order_sql}
        LIMIT ${limit_idx} OFFSET ${offset_idx}
        """,
        *params,
    )

    # ---- 필터 칩 구성용: 활성 기사에 존재하는 회사별/유형별 개수 ----
    company_rows = await pool.fetch(
        """
        SELECT search_query, count(*) AS n
        FROM working_news_articles
        WHERE is_active = TRUE
        GROUP BY search_query
        """
    )
    company_counts: dict[str, int] = {}
    for r in company_rows:
        company_counts[_company_of(r["search_query"])] = (
            company_counts.get(_company_of(r["search_query"]), 0) + r["n"]
        )
    # 회사 칩 순서: 고정 회사 순서 → 기타. 데이터에 존재하는 것만.
    companies = [
        {"name": name, "count": company_counts[name]}
        for name in (*_COMPANY_QUERIES, _OTHER)
        if company_counts.get(name)
    ]

    cat_rows = await pool.fetch(
        """
        SELECT c AS name, count(*) AS n
        FROM working_news_articles,
             LATERAL unnest(ARRAY[primary_category, secondary_category]) AS c
        WHERE is_active = TRUE AND c IS NOT NULL
        GROUP BY c
        """
    )
    cat_counts = {r["name"]: r["n"] for r in cat_rows}
    categories = [
        {"name": name, "count": cat_counts[name]}
        for name in _CATEGORIES
        if cat_counts.get(name)
    ]

    total = await pool.fetchval(
        f"SELECT count(*) FROM working_news_articles WHERE {where_sql}",
        *params[: len(params) - 2],  # limit/offset 제외
    )

    return {
        "count": len(rows),
        "total": total,
        "companies": companies,
        "categories": categories,
        "items": [_news_item(dict(r)) for r in rows],
    }


@router.get("/news/briefing")
async def news_briefing(_user: dict = Depends(get_current_user)):
    """뉴스 AI 위클리 브리핑(news_briefing) 최신 1건을 반환.

    네 갈래(자사 뉴스 / 경쟁사 동향 / 시장 동향 / 소비자 관심사)로 미리 생성·적재된
    브리핑을 화면이 읽기만 한다. 아직 생성 전이면 pending=true.
    (self_news 는 현재 비어 있을 수 있음 — 채움 주체는 추후 결정)
    """
    pool = db.get_pool()
    row = await pool.fetchrow(
        """
        SELECT created_at, self_news, competitor_trends, market_trends, consumer_interests
        FROM news_briefing
        ORDER BY created_at DESC
        LIMIT 1
        """
    )
    if row is None:
        return {
            "created_at": None,
            "self_news": None,
            "competitor_trends": None,
            "market_trends": None,
            "consumer_interests": None,
            "pending": True,
        }
    return {**dict(row), "pending": False}
