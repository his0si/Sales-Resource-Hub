"""뉴스 AI 위클리 브리핑 백그라운드 생성기.

working_news_articles(최근 활성 뉴스)를 바탕으로 로컬 LLM 이 요약을 만들어
news_briefing 테이블에 저장한다. 요청 핸들러(/news/briefing)는 저장된 값을 즉시 읽기만 한다.

테이블은 네 갈래(self_news / competitor_trends / market_trends / consumer_interests)다.
현재 자체 생성은 아래 세 갈래만 채우고 self_news(자사 뉴스)는 비워 둔다
(자사 뉴스를 누가 채울지 = 자체 생성 vs 외부 JSON 적재 는 추후 결정):
  · market_trends         시장 트렌드
  · competitor_trends      경쟁사 동향
  · consumer_interests    소비자 관심사

신선도 판정 — 다음 중 하나면 재생성한다:
  · 아직 브리핑이 없음
  · 새 뉴스가 적재됨(working_news_articles 활성 최대 id 가 저장 시점보다 큼)
  · 마지막 생성으로부터 briefing_ttl_seconds 경과

briefing_backfill 과 같은 패턴으로 main.py lifespan 에서 백그라운드 태스크로 실행.
ollama 가 죽어 있으면 생성 실패 → 길게 쉬었다가 재시도(살아나면 자동 재개).
"""

import asyncio

from app import db, gemini
from app.config import settings

# 네 갈래(self_news/competitor_trends/market_trends/consumer_interests) 테이블을 기동 시 보장.
_ENSURE_TABLE = """
CREATE TABLE IF NOT EXISTS news_briefing (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    self_news TEXT,
    competitor_trends TEXT,
    market_trends TEXT,
    consumer_interests TEXT
)
"""
# 기존 3컬럼 테이블 → 4컬럼 이행 + 누락 컬럼 보강(idempotent).
_ENSURE_COLS = (
    """
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'news_briefing'
                     AND column_name = 'competitor_production_trends')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name = 'news_briefing'
                             AND column_name = 'competitor_trends')
        THEN
            ALTER TABLE news_briefing
                RENAME COLUMN competitor_production_trends TO competitor_trends;
        END IF;
    END $$;
    """,
    "ALTER TABLE news_briefing ADD COLUMN IF NOT EXISTS self_news TEXT",
    "ALTER TABLE news_briefing ADD COLUMN IF NOT EXISTS competitor_trends TEXT",
    "ALTER TABLE news_briefing ADD COLUMN IF NOT EXISTS latest_article_id BIGINT",
)

# 브리핑 생성에 쓸 최근 활성 뉴스(발행 최신순).
_PICK = """
    SELECT search_query, title, description
    FROM working_news_articles
    WHERE is_active = TRUE
    ORDER BY published_at_kst DESC NULLS LAST, id DESC
    LIMIT $1
"""

# (컬럼, 화면 제목, 요약 관점)
_SECTIONS = [
    (
        "market_trends",
        "시장 트렌드",
        "건자재·인테리어 시장 전반의 수요 흐름과 거시 트렌드",
    ),
    (
        "competitor_trends",
        "경쟁사 동향",
        "경쟁사(KCC·KCC글라스·LX하우시스·동화자연마루·구정마루·예림·영림 등)의 신제품·생산·출시 동향",
    ),
    (
        "consumer_interests",
        "소비자 관심사",
        "소비자가 주목하는 제품 특성·관심사(친환경·기능성·가성비 등)",
    ),
]

_NEWS_LIMIT = 40  # 요약 입력으로 넣을 최근 뉴스 수


def _clip(text: str | None, n: int = 80) -> str:
    if not text:
        return ""
    return " ".join(text.split())[:n]


def _news_block(rows: list[dict]) -> str:
    lines = []
    for r in rows:
        title = _clip(r.get("title"), 70)
        if not title:
            continue
        company = (r.get("search_query") or "").strip()
        desc = _clip(r.get("description"), 60)
        piece = title
        if company:
            piece = f"[{company}] {piece}"
        if desc:
            piece = f"{piece} — {desc}"
        lines.append(f"- {piece}")
    return "\n".join(lines[:_NEWS_LIMIT]) or "- (최근 뉴스 없음)"


def _build_prompt(label: str, perspective: str, news_block: str) -> str:
    # 경쟁사 동향 섹션은 "무엇을 했는지"가 드러나는 구체적 사실만 (halyn weekly_report 규칙 이식)
    extra = ""
    if label == "경쟁사 동향":
        extra = (
            "- 단순 광고·후원·홍보·행사 참여·사회공헌은 제외하고, 제품 출시·기술 개발·사업 확장·"
            "유통 전략·건설사 협업 등 영업과 직접 관련된 사실만 포함한다.\n"
            "- '마케팅 활동을 진행함' 같은 추상적 표현 대신 '무엇을 했는지'가 드러나게 쓴다 "
            "(예: 'KCC글라스가 항바이러스 PVC 바닥재를 출시함').\n"
        )
    return (
        "당신은 뉴스 분석가가 아니라 한솔홈데코 영업사원을 위한 뉴스 브리핑 작성자입니다.\n"
        "한솔홈데코는 바닥재·벽장재·가구재·인테리어 필름·시트재·세라믹 등 인테리어 건자재 기업입니다.\n"
        f"아래 최근 뉴스에서 '{label}' 관점({perspective})의 핵심 사실만 한국어 불릿 3개로 압축하세요.\n"
        "규칙:\n"
        "- 각 줄은 '- '로 시작한다.\n"
        "- 보고서 개조식으로 작성하고, 문장은 반드시 '~함/~됨/~임/~음' 같은 명사형 종결로 끝낸다 "
        "(예: '수요가 증가함', '트렌드가 확산됨', '관심이 높음').\n"
        "- 마침표(.)를 찍지 않는다.\n"
        "- 한솔홈데코 사업과 무관한 산업(반도체·AI·자동차·금융·정치 등) 뉴스는 제외한다.\n"
        "- 시사점·전망·원인 분석·의견은 쓰지 않고, 기사에서 확인 가능한 사실만 적는다.\n"
        f"{extra}"
        "- 목록에 없는 내용은 지어내지 않는다.\n"
        "- 머리말·제목 없이 불릿 3줄만 출력한다.\n\n"
        f"[최근 뉴스]\n{news_block}\n\n[요약]\n"
    )


def _normalize_bullets(text: str) -> str:
    """LLM 출력 → '한 줄에 하나'의 정돈된 불릿 텍스트(머리표 제거, 최대 3줄)."""
    lines = []
    for raw in text.splitlines():
        line = raw.strip().lstrip("-•*").strip()
        line = line.rstrip(" .")  # 개조식: 끝의 마침표 제거
        if line:
            lines.append(line)
    return "\n".join(lines[:3])


async def _pick_target(pool) -> int | None:
    """재생성이 필요하면 현재 활성 뉴스 최대 id 를, 아니면 None 을 반환."""
    max_id = await pool.fetchval(
        "SELECT max(id) FROM working_news_articles WHERE is_active = TRUE"
    )
    if max_id is None:
        return None  # 보여줄 뉴스가 없으면 만들 게 없음
    row = await pool.fetchrow(
        """
        SELECT latest_article_id,
               EXTRACT(EPOCH FROM (NOW() - created_at)) AS age
        FROM news_briefing
        ORDER BY created_at DESC
        LIMIT 1
        """
    )
    if row is None:
        return max_id  # 아직 없음
    if row["latest_article_id"] != max_id:
        return max_id  # 새 뉴스 적재됨
    if (row["age"] or 0) >= settings.briefing_ttl_seconds:
        return max_id  # TTL 경과
    return None


async def _generate(pool) -> bool:
    """재생성이 필요하면 세 갈래 요약을 만들어 저장. 처리했으면 True."""
    max_id = await _pick_target(pool)
    if max_id is None:
        return False
    rows = [dict(r) for r in await pool.fetch(_PICK, _NEWS_LIMIT)]
    block = _news_block(rows)
    result: dict[str, str] = {}
    for col, label, perspective in _SECTIONS:
        try:
            text = await gemini.generate(_build_prompt(label, perspective, block))
        except gemini.GeminiError:
            return False  # 키 미설정/호출 실패 등 → 상위 루프가 길게 대기 후 재시도
        result[col] = _normalize_bullets(text)
    # 최신 1건만 유지(append 후 옛 행 정리).
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                """
                INSERT INTO news_briefing
                    (market_trends, competitor_trends, consumer_interests,
                     latest_article_id, created_at)
                VALUES ($1, $2, $3, $4, NOW())
                """,
                result["market_trends"],
                result["competitor_trends"],
                result["consumer_interests"],
                max_id,
            )
            await conn.execute(
                "DELETE FROM news_briefing WHERE id < (SELECT max(id) FROM news_briefing)"
            )
    return True


async def run_forever() -> None:
    if not settings.briefing_enabled:
        print("[news_briefing_backfill] 비활성화됨(BRIEFING_ENABLED=false)")
        return
    print("[news_briefing_backfill] 뉴스 AI 위클리 브리핑 백그라운드 생성 시작")
    while True:
        try:
            if db.pool is not None:
                await db.pool.execute(_ENSURE_TABLE)
                for _sql in _ENSURE_COLS:
                    await db.pool.execute(_sql)
                did = await _generate(db.pool)
            else:
                did = False
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            print(f"[news_briefing_backfill] 오류(계속 진행): {exc!r}")
            did = False
        await asyncio.sleep(settings.briefing_interval if did else 60)
