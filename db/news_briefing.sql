-- ============================================================
-- news_briefing (뉴스 AI 요약/브리핑) 테이블
--   working_news_articles(최근 활성 기사)를 바탕으로 LLM 이 생성한
--   뉴스 브리핑을 네 갈래(자사 뉴스 / 경쟁사 동향 / 시장 동향 / 소비자 관심사)로 저장한다.
--   생성 시각마다 한 행을 적재(append)하며, 화면은 최신 created_at 한 건을 읽어 보여준다.
--   실행: PGPASSWORD=<pw> psql -h 127.0.0.1 -p 5433 -U hansolax -d hansolax -f db/news_briefing.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS news_briefing (
    id BIGSERIAL PRIMARY KEY,

    -- 브리핑 생성 시각 (이 값이 최신인 행을 화면에 노출)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 자사(한솔홈데코) 뉴스 요약
    self_news TEXT,

    -- 경쟁사 동향 요약
    competitor_trends TEXT,

    -- 시장 동향 요약
    market_trends TEXT,

    -- 소비자 관심사 요약
    consumer_interests TEXT,

    -- 신선도 판정용: 생성 시점의 활성 뉴스 최대 id (새 뉴스 적재 감지)
    latest_article_id BIGINT
);

-- ── 기존 3컬럼 테이블 → 4컬럼 이행 (이미 적용돼 있으면 건너뜀) ──
-- competitor_production_trends → competitor_trends 로 이름 변경
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

-- 신규/누락 컬럼 보강 (self_news 추가, 그 외는 안전망)
ALTER TABLE news_briefing ADD COLUMN IF NOT EXISTS self_news TEXT;
ALTER TABLE news_briefing ADD COLUMN IF NOT EXISTS competitor_trends TEXT;
ALTER TABLE news_briefing ADD COLUMN IF NOT EXISTS market_trends TEXT;
ALTER TABLE news_briefing ADD COLUMN IF NOT EXISTS consumer_interests TEXT;
ALTER TABLE news_briefing ADD COLUMN IF NOT EXISTS latest_article_id BIGINT;

-- 최신 브리핑 조회(ORDER BY created_at DESC LIMIT 1)를 빠르게
CREATE INDEX IF NOT EXISTS idx_news_briefing_created_at
    ON news_briefing(created_at DESC);
