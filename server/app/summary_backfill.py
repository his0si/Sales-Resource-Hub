"""세일즈 메모 AI 요약·제목 백그라운드 생성기.

ai_summary(3줄 요약) 또는 ai_title(카드 제목)이 비어 있는 메모를 최신순으로 한 건씩 골라
로컬 LLM 으로 만들어 저장한다.
 - 새 메일이 폴러로 적재되면(둘 다 NULL) 이 작업이 곧 채운다 → 화면에 즉시 반영.
 - 기존 메모도 백그라운드로 점진 백필.
 - ollama 가 죽어 있으면 생성 실패 → 길게 쉬었다가 재시도(살아나면 자동 재개).

main.py lifespan 에서 백그라운드 태스크로 실행.
"""

import asyncio

from app import db, llm, sales_memo_ai
from app.config import settings

# 요약·제목·태그 생성에 필요한 컬럼 + 어느 게 비었는지 확인용
_PICK = """
    id, customer_name, activity_plan, strategy, operation,
    product, personal, takeaway, followup_plan, ai_summary, ai_title, ai_tags
"""


async def _fill_one(pool) -> bool:
    """요약/제목/태그가 빈 메모 1건을 생성·저장. 처리했으면 True, 없거나 실패면 False."""
    row = await pool.fetchrow(
        f"""
        SELECT {_PICK} FROM sales_memo
        WHERE ai_summary IS NULL OR ai_title IS NULL OR ai_tags IS NULL
        ORDER BY written_at DESC NULLS LAST, id DESC
        LIMIT 1
        """
    )
    if not row:
        return False
    memo = dict(row)
    updates: dict[str, str] = {}
    try:
        if memo["ai_summary"] is None:
            bullets = await sales_memo_ai.summarize(memo)
            updates["ai_summary"] = sales_memo_ai.join_summary(bullets)
        if memo["ai_title"] is None:
            updates["ai_title"] = await sales_memo_ai.generate_title(memo)
        if memo["ai_tags"] is None:
            # 태그는 제목(겹침 회피)·요약(핵심)을 기준으로 생성
            title = updates.get("ai_title") or memo.get("ai_title") or ""
            summary = updates.get("ai_summary") or memo.get("ai_summary")
            tags = await sales_memo_ai.generate_tags(memo, title=title, summary=summary)
            updates["ai_tags"] = sales_memo_ai.join_tags(tags)
    except llm.LLMError:
        # ollama 미가동 등 → 조용히 실패(상위 루프가 길게 대기 후 재시도)
        return False
    if not updates:
        return False
    cols = list(updates)
    set_clause = ", ".join(f"{c} = ${i}" for i, c in enumerate(cols, start=1))
    values = [updates[c] for c in cols] + [memo["id"]]
    await pool.execute(
        f"UPDATE sales_memo SET {set_clause} WHERE id = ${len(values)}", *values
    )
    return True


async def run_forever() -> None:
    if not settings.ai_summary_enabled:
        print("[summary_backfill] 비활성화됨(AI_SUMMARY_ENABLED=false)")
        return
    print("[summary_backfill] AI 요약 백그라운드 생성 시작")
    while True:
        try:
            did = await _fill_one(db.pool) if db.pool is not None else False
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            print(f"[summary_backfill] 오류(계속 진행): {exc!r}")
            did = False
        # 처리했으면 짧게, 없거나 실패면 길게 쉰다(새 메일·ollama 복구 대기).
        await asyncio.sleep(settings.ai_summary_interval if did else 60)
