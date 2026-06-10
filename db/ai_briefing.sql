-- ============================================================
-- ai_briefing (AI 위클리 브리핑) 테이블
--   부서별로 로컬 LLM 이 생성한 주간 브리핑을 저장한다.
--   생성: 서버의 briefing_backfill 백그라운드 작업이 미리 만들어 upsert.
--         (요청 시점에 LLM 을 호출하지 않음 → 화면은 저장된 값을 즉시 표시)
--   갱신: 새 메모가 적재되거나(latest_memo_id 변화) TTL 경과 시 재생성.
--   실행: PGPASSWORD=<pw> psql -h 127.0.0.1 -p 5433 -U hansolax -d hansolax -f db/ai_briefing.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_briefing (
    department     VARCHAR(100) PRIMARY KEY,   -- 부서명(브리핑 단위)
    briefing       TEXT         NOT NULL,       -- 생성된 브리핑 본문
    latest_memo_id INTEGER,                     -- 생성 시점 sales_memo 최대 id(신선도 판정용)
    memo_count     INTEGER,                     -- 생성에 사용한 메모 수(참고용)
    generated_at   TIMESTAMP    DEFAULT NOW()   -- 생성 시각
);
