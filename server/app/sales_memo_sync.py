"""[HSP SalesMemo] 메일 → sales_memo 자동 적재 폴러.

흐름:
  1) Gmail 에서 대상 메일 id 목록을 가져온다(settings.sales_memo_query).
  2) 이미 적재된 gmail_id 는 건너뛰고, 새 메일만 full 로 받아 본문 HTML 을 파싱한다.
  3) sales_memo 에 upsert(gmail_id 기준)한다. 멱등이라 재실행해도 안전하다.

main.py 의 lifespan 에서 백그라운드 태스크로 주기 실행된다.
Gmail 미설정/DB 미연결/일시 오류는 로그만 남기고 다음 주기로 넘어간다.
"""

import asyncio
import base64
import binascii

from app import db, gmail_client
from app.config import settings
from app.gmail_client import GmailNotConfigured
from app.sales_memo_parser import parse_memo_html

# upsert 컬럼 순서 (visit_no, gmail_id 다음에 들어갈 값들).
# customer_code/author_emp_no 는 메일에 없어 기존 데이터에서 보강한다(_enrich).
_MEMO_COLUMNS = [
    "customer_name",
    "customer_code",
    "planned_visit_date",
    "visit_date",
    "author_name",
    "author_emp_no",
    "written_at",
    "activity_plan",
    "strategy",
    "operation",
    "product",
    "personal",
    "takeaway",
    "followup_plan",
]


def _decode_b64url(data: str) -> str:
    padded = data + "=" * (-len(data) % 4)
    try:
        raw = base64.urlsafe_b64decode(padded)
    except (binascii.Error, ValueError):
        return ""
    return raw.decode("utf-8", "replace")


def _find_part(part: dict, mime: str) -> dict | None:
    if part.get("mimeType") == mime and part.get("body", {}).get("data"):
        return part
    for sub in part.get("parts", []) or []:
        found = _find_part(sub, mime)
        if found:
            return found
    return None


def _extract_html(payload: dict | None) -> str:
    if not payload:
        return ""
    html_part = _find_part(payload, "text/html")
    if html_part:
        return _decode_b64url(html_part["body"]["data"])
    return ""


async def _existing_gmail_ids(pool, ids: list[str]) -> set[str]:
    if not ids:
        return set()
    rows = await pool.fetch(
        "SELECT gmail_id FROM sales_memo WHERE gmail_id = ANY($1::text[])", ids
    )
    return {r["gmail_id"] for r in rows}


async def _enrich(pool, fields: dict) -> None:
    """메일엔 없는 거래선코드·작성자 사번을, 같은 거래선/작성자의 기존 행에서 가져와 채운다."""
    customer_name = fields.get("customer_name")
    if customer_name and not fields.get("customer_code"):
        fields["customer_code"] = await pool.fetchval(
            "SELECT customer_code FROM sales_memo "
            "WHERE customer_name = $1 AND customer_code IS NOT NULL AND customer_code <> '' "
            "ORDER BY written_at DESC NULLS LAST LIMIT 1",
            customer_name,
        )
    author_name = fields.get("author_name")
    if author_name and not fields.get("author_emp_no"):
        fields["author_emp_no"] = await pool.fetchval(
            "SELECT author_emp_no FROM sales_memo "
            "WHERE author_name = $1 AND author_emp_no IS NOT NULL AND author_emp_no <> '' "
            "ORDER BY written_at DESC NULLS LAST LIMIT 1",
            author_name,
        )


async def _upsert_memo(pool, gmail_id: str, fields: dict) -> None:
    visit_no = f"GM{gmail_id}"[:20]
    values = [visit_no, gmail_id] + [fields.get(col) for col in _MEMO_COLUMNS]
    placeholders = ", ".join(f"${n}" for n in range(1, len(values) + 1))
    update_set = ", ".join(f"{col} = EXCLUDED.{col}" for col in _MEMO_COLUMNS)
    sql = f"""
        INSERT INTO sales_memo (visit_no, gmail_id, {", ".join(_MEMO_COLUMNS)})
        VALUES ({placeholders})
        ON CONFLICT (gmail_id) WHERE gmail_id IS NOT NULL
        DO UPDATE SET {update_set}
    """
    await pool.execute(sql, *values)


async def sync_once() -> int:
    """대상 메일을 한 번 훑어 새 메일을 적재. 새로 적재한 건수를 반환."""
    if db.pool is None:
        return 0
    try:
        items = await gmail_client.list_messages(
            max_results=settings.sales_memo_max_scan, query=settings.sales_memo_query
        )
    except GmailNotConfigured:
        return 0

    ids = [m["id"] for m in items]
    already = await _existing_gmail_ids(db.pool, ids)
    new_ids = [mid for mid in ids if mid not in already]

    inserted = 0
    for mid in new_ids:
        try:
            msg = await gmail_client.get_message(mid, fmt="full")
            fields = parse_memo_html(_extract_html(msg.get("payload")))
            if not fields:
                print(f"[sales_memo_sync] 파싱 결과 없음, 건너뜀: {mid}")
                continue
            await _enrich(db.pool, fields)
            await _upsert_memo(db.pool, mid, fields)
            inserted += 1
        except Exception as exc:  # 한 건 실패가 전체를 막지 않도록
            print(f"[sales_memo_sync] 메일 처리 실패({mid}): {exc!r}")

    if inserted:
        print(f"[sales_memo_sync] 새 영업일지 {inserted}건 적재")
    return inserted


async def run_forever() -> None:
    """설정 주기로 sync_once 를 반복. 취소(앱 종료) 시 조용히 끝낸다."""
    if not settings.sales_memo_sync_enabled:
        print("[sales_memo_sync] 비활성화됨(SALES_MEMO_SYNC_ENABLED=false)")
        return
    print(
        f"[sales_memo_sync] 폴링 시작: 주기 {settings.sales_memo_poll_seconds}s, "
        f"검색식 {settings.sales_memo_query!r}"
    )
    while True:
        try:
            await sync_once()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            print(f"[sales_memo_sync] 폴링 주기 오류(계속 진행): {exc!r}")
        await asyncio.sleep(settings.sales_memo_poll_seconds)
