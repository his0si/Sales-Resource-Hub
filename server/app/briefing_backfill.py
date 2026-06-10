"""AI 위클리 브리핑 백그라운드 생성기.

부서별 주간 브리핑을 로컬 LLM 으로 미리 만들어 ai_briefing 테이블에 저장한다.
요청 핸들러(/sales-memo/briefing)는 저장된 값을 즉시 읽기만 한다(LLM 미호출).

신선도 판정 — 다음 중 하나면 해당 부서 브리핑을 재생성한다:
  · 아직 브리핑이 없음
  · 새 메모가 적재됨(sales_memo 의 최대 id 가 저장 시점보다 큼)
  · 마지막 생성으로부터 briefing_ttl_seconds 경과(새 메모가 없어도 주기 갱신)

summary_backfill 과 같은 패턴으로 main.py lifespan 에서 백그라운드 태스크로 실행.
ollama 가 죽어 있으면 생성 실패 → 길게 쉬었다가 재시도(살아나면 자동 재개).
"""

import asyncio

from app import db, llm
from app.config import settings

# 부서별 브리핑 저장 테이블(수동 마이그레이션 없이도 동작하도록 기동 시 보장).
_ENSURE_TABLE = """
CREATE TABLE IF NOT EXISTS ai_briefing (
    department     VARCHAR(100) PRIMARY KEY,
    briefing       TEXT         NOT NULL,
    latest_memo_id INTEGER,
    memo_count     INTEGER,
    generated_at   TIMESTAMP    DEFAULT NOW()
)
"""

# 브리핑 생성에 필요한 컬럼만 최신순으로.
_PICK = """
    SELECT customer_name, activity_plan, takeaway
    FROM sales_memo
    ORDER BY written_at DESC NULLS LAST, visit_date DESC NULLS LAST, id DESC
    LIMIT $1
"""


def _first_line(text: str | None) -> str:
    if not text:
        return ""
    for line in text.splitlines():
        line = line.strip()
        if line:
            return line[:46]
    return ""


def _build_prompt(dept: str, memos: list[dict]) -> str:
    lines = []
    for m in memos:
        cust = (m.get("customer_name") or "").strip()
        plan = _first_line(m.get("activity_plan"))
        take = _first_line(m.get("takeaway"))
        piece = " / ".join(p for p in [cust, plan, take] if p)
        if piece:
            lines.append(f"- {piece}")
    memo_block = "\n".join(lines[: settings.briefing_memo_limit]) or "- (최근 메모 없음)"
    return (
        "당신은 한솔홈데코 영업 지원 어시스턴트입니다. 아래는 최근 영업 메모 목록입니다.\n"
        f"'{dept}' 부서 관점에서, 자주 등장한 제품·지역·이슈와 주목할 거래선 동향을 "
        "한국어 3~4문장으로 요약해 주세요. 목록에 없는 내용은 지어내지 말고, "
        "존댓말 평서문으로 작성하세요. 머리말이나 목록 없이 본문만 출력하세요.\n\n"
        f"[최근 영업 메모]\n{memo_block}\n\n[주간 브리핑]\n"
    )


async def _pick_stale_dept(pool) -> tuple[str, int, int] | None:
    """재생성이 필요한 부서 하나를 고른다. (부서, 현재 max_id, memo_count) 또는 None."""
    max_id = await pool.fetchval("SELECT max(id) FROM sales_memo")
    if max_id is None:
        return None  # 메모가 한 건도 없으면 만들 게 없음
    memo_count = await pool.fetchval("SELECT count(*) FROM sales_memo")
    existing = {
        r["department"]: r
        for r in await pool.fetch(
            "SELECT department, latest_memo_id, generated_at,"
            " EXTRACT(EPOCH FROM (NOW() - generated_at)) AS age FROM ai_briefing"
        )
    }
    for dept in settings.department_list:
        row = existing.get(dept)
        if row is None:
            return dept, max_id, memo_count                      # 아직 없음
        if row["latest_memo_id"] != max_id:
            return dept, max_id, memo_count                      # 새 메모 적재됨
        if (row["age"] or 0) >= settings.briefing_ttl_seconds:
            return dept, max_id, memo_count                      # TTL 경과
    return None


async def _generate_one(pool) -> bool:
    """재생성이 필요한 부서 1건을 생성·저장. 처리했으면 True, 없거나 실패면 False."""
    target = await _pick_stale_dept(pool)
    if target is None:
        return False
    dept, max_id, memo_count = target
    rows = await pool.fetch(_PICK, settings.briefing_memo_limit)
    prompt = _build_prompt(dept, [dict(r) for r in rows])
    try:
        text = await llm.generate(prompt)
    except llm.LLMError:
        # ollama 미가동 등 → 조용히 실패(상위 루프가 길게 대기 후 재시도)
        return False
    await pool.execute(
        """
        INSERT INTO ai_briefing (department, briefing, latest_memo_id, memo_count, generated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (department) DO UPDATE
        SET briefing = EXCLUDED.briefing,
            latest_memo_id = EXCLUDED.latest_memo_id,
            memo_count = EXCLUDED.memo_count,
            generated_at = NOW()
        """,
        dept, text, max_id, memo_count,
    )
    return True


async def run_forever() -> None:
    if not settings.briefing_enabled:
        print("[briefing_backfill] 비활성화됨(BRIEFING_ENABLED=false)")
        return
    print("[briefing_backfill] AI 위클리 브리핑 백그라운드 생성 시작")
    while True:
        try:
            if db.pool is not None:
                await db.pool.execute(_ENSURE_TABLE)
                did = await _generate_one(db.pool)
            else:
                did = False
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            print(f"[briefing_backfill] 오류(계속 진행): {exc!r}")
            did = False
        # 처리했으면 짧게, 없거나 실패면 길게 쉰다(새 메일·ollama 복구·TTL 대기).
        await asyncio.sleep(settings.briefing_interval if did else 60)
