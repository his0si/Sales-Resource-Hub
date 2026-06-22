"""영업일지(sales_memo) 조회 라우터.

Gmail 로 들어온 [HSP SalesMemo] 메일은 폴러(sales_memo_sync)가 DB 에 적재하므로,
화면은 Gmail 을 직접 보지 않고 이 테이블만 최신순으로 읽어 보여준다.
로그인한 앱 사용자(Bearer)만 접근 가능.
"""

from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from app import categories, db, employees, llm, sales_memo_ai
from app.config import settings
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api", tags=["sales-memo"])

# 화면 표 렌더링에 필요한 컬럼들 (작성일/방문일 최신순 정렬)
_FIELDS = """
    id, visit_no, customer_name, customer_code,
    author_name, author_emp_no,
    planned_visit_date, visit_date, written_at,
    activity_plan, strategy, operation, product, personal, takeaway, followup_plan,
    gmail_id, ai_summary, ai_title, ai_tags
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


# ============================================================
# 세일즈 메모 보드 (/sales-memo 새 디자인) — 카테고리(부서) 분류 + 해시태그
# ============================================================

def _fmt_md(value) -> str:
    """date/datetime -> 'MM.DD' (없으면 빈 문자열)."""
    if isinstance(value, (datetime, date)):
        return value.strftime("%m.%d")
    return ""


def _first_line(text: str | None) -> str:
    if not text:
        return ""
    for line in text.splitlines():
        line = line.strip()
        if line:
            return line[:46]
    return ""


def _board_item(
    memo: dict,
    my_dept: str,
    recent_after: date | None,
    directory: employees.EmployeeDirectory,
) -> dict:
    author = memo.get("author_name") or "작성자 미상"
    # 메모의 부서/부문 = 작성자(사번 우선, 성명 폴백)를 조직표와 대조해 판별
    dept, division = directory.lookup(memo.get("author_emp_no"), memo.get("author_name"))
    prod_cat = categories.classify(memo)  # 해시태그(제품군)용 분류
    # 제목: 미리 생성된 AI 제목 우선, 없으면 '거래선, 활동계획 첫 줄'로 폴백.
    # 어느 경우든 원문 불릿(○ 등)·이모지를 제거한다.
    customer = (memo.get("customer_name") or "").strip()
    title = sales_memo_ai.clean_title(memo.get("ai_title"))
    if not title:
        head = sales_memo_ai.clean_title(_first_line(memo.get("activity_plan")))
        if customer and head:
            title = f"{customer}, {head}"
        else:
            title = customer or head or "(제목 없음)"

    written = memo.get("written_at")
    visited = memo.get("visit_date")
    when = written if isinstance(written, (datetime, date)) else visited
    when_date = when.date() if isinstance(when, datetime) else when

    return {
        "id": memo["id"],
        "title": title,
        "customer": customer or None,
        "dept": dept,
        "division": division,
        "own": dept is not None and dept == my_dept,
        "unread": bool(recent_after and when_date and when_date >= recent_after),
        "author": author,
        "date": _fmt_md(when),
        # 해시태그: 미리 생성된 AI 태그(이슈/상태 중심) 우선, 없으면 규칙기반 폴백
        "tags": sales_memo_ai.split_tags(memo.get("ai_tags"))
        or categories.extract_tags(memo, prod_cat),
        "summary": sales_memo_ai.split_summary(memo.get("ai_summary")),
        "gmail_id": memo.get("gmail_id"),
    }


@router.get("/sales-memo/board")
async def sales_memo_board(
    dept: str | None = Query(None, description="부서(팀) 필터. 미지정=본인 부서 우선, '전체'=전체"),
    limit: int = Query(2000, ge=1, le=5000),
    _user: dict = Depends(get_current_user),
):
    """세일즈 메모를 보드 카드로 가공해 반환. 본인(로그인 사용자) 부서 우선 정렬."""
    pool = db.get_pool()
    rows = await pool.fetch(
        f"""
        SELECT {_FIELDS}
        FROM sales_memo
        ORDER BY written_at DESC NULLS LAST, visit_date DESC NULLS LAST, id DESC
        LIMIT $1
        """,
        limit,
    )
    my_dept = _user.get("department") or settings.my_department
    directory = await employees.load_directory(pool)
    # 최신 작성일 기준 1일 이내를 '새 글(점 채움)'로 표시
    newest = max(
        (r["written_at"].date() if isinstance(r["written_at"], datetime) else r["written_at"])
        for r in rows
        if r["written_at"]
    ) if rows else None
    recent_after = newest - timedelta(days=1) if newest else None

    items = [_board_item(dict(r), my_dept, recent_after, directory) for r in rows]

    if dept == "전체":
        pass  # 최신순 그대로
    elif dept:
        items = [it for it in items if it["dept"] == dept]
    else:
        # 본인 부서 우선(기본): 본인 부서를 위로, 그 안에서는 최신순 유지
        items.sort(key=lambda it: not it["own"])

    return {
        "count": len(items),
        "my_department": my_dept,
        "departments": settings.department_list,
        "items": items,
    }


# ---- AI 위클리 브리핑 ----
#  생성은 briefing_backfill 백그라운드 작업이 미리 해 ai_briefing 에 저장한다.
#  이 핸들러는 LLM 을 호출하지 않고 저장된 값을 즉시 읽기만 한다(요청 블로킹 없음).
@router.get("/sales-memo/briefing")
async def sales_memo_briefing(
    dept: str | None = Query(None, description="조회할 부서(미지정 시 본인 부서)"),
    _user: dict = Depends(get_current_user),
):
    """미리 생성된 부서별 AI 위클리 브리핑을 ai_briefing 에서 읽어 반환.

    화면 필터에서 고른 부서(dept)의 브리핑을 보여준다. dept 가 없거나 부서 목록에
    없는 값이면 본인 부서(없으면 기본 부서)로 폴백한다.
    """
    target_dept = dept if dept in settings.department_list else None
    target_dept = target_dept or _user.get("department") or settings.my_department
    pool = db.get_pool()
    row = await pool.fetchrow(
        "SELECT briefing, generated_at FROM ai_briefing WHERE department = $1",
        target_dept,
    )
    if row is None:
        # 아직 백그라운드 생성 전 → 프론트는 '요약하는 중' 상태를 표시한다.
        return {"briefing": "", "generated_at": None, "pending": True}
    return {
        "briefing": row["briefing"],
        "generated_at": row["generated_at"],
        "pending": False,
    }


# 단건 원문 조회 (보드 카드의 "원문" 모달에서 사용). 정적 경로(board/briefing) 뒤에 선언.
@router.get("/sales-memo/{memo_id}")
async def get_sales_memo(memo_id: int, _user: dict = Depends(get_current_user)):
    pool = db.get_pool()
    row = await pool.fetchrow(f"SELECT {_FIELDS} FROM sales_memo WHERE id = $1", memo_id)
    if not row:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
    # 작성자(사번 우선, 성명 폴백)를 조직표와 대조해 부서/부문 판별
    directory = await employees.load_directory(pool)
    dept, division = directory.lookup(row["author_emp_no"], row["author_name"])
    return {**dict(row), "dept": dept, "division": division}


# ---- 메모별 3줄 AI 요약 (DB 저장분 우선, 없으면 즉석 생성) ----
@router.get("/sales-memo/{memo_id}/summary")
async def sales_memo_summary(memo_id: int, _user: dict = Depends(get_current_user)):
    """저장된 ai_summary 가 있으면 즉시 반환, 없으면 그 자리에서 생성·저장."""
    pool = db.get_pool()
    row = await pool.fetchrow(f"SELECT {_FIELDS} FROM sales_memo WHERE id = $1", memo_id)
    if not row:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
    if row["ai_summary"]:
        return {"summary": sales_memo_ai.split_summary(row["ai_summary"]), "cached": True}
    try:
        bullets = await sales_memo_ai.summarize(dict(row))
    except llm.LLMError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    await pool.execute(
        "UPDATE sales_memo SET ai_summary = $1 WHERE id = $2",
        sales_memo_ai.join_summary(bullets),
        memo_id,
    )
    return {"summary": bullets, "cached": False}
