-- ============================================================
-- sales_memo (영업일지) 테이블
--   원본: "2달간 영업일지 데이터.xlsx" / SQL 시트의 TB_VISIT_H 조회 결과
--   증분: [HSP SalesMemo] 메일이 오면 서버 폴러가 파싱해 자동 upsert (gmail_id 기준).
--         메일에는 visit_no 가 없어 'GM'+Gmail메시지id 를 visit_no 로 쓰고,
--         실제 dedup 키는 gmail_id(부분 유니크 인덱스)다.
--   실행: PGPASSWORD=<pw> psql -h 127.0.0.1 -p 5433 -U hansolax -d hansolax -f db/sales_memo.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS sales_memo (
    id                  SERIAL       PRIMARY KEY,            -- 내부 고유 ID (자동 증가)
    visit_no            VARCHAR(20)  UNIQUE NOT NULL,        -- 영업일지번호 (VISIT_NO). 메일유입분은 'GM'+gmail_id
    visit_date          DATE,                                -- 방문일 (VISIT_DT)
    planned_visit_date  DATE,                                -- 방문예정일 (VISIT_DT_P)
    written_at          TIMESTAMP,                           -- 작성일 (ERDAT)
    author_emp_no       VARCHAR(20),                         -- 작성자 사번 (ERNAM)
    author_name         VARCHAR(100),                        -- 작성자명 (USER_NM)
    customer_code       VARCHAR(20),                         -- 거래선코드 (KUNNR)
    customer_name       VARCHAR(255),                        -- 거래선 (KUNNR_NM)
    strategy            TEXT,                                -- 전략 (NEEDS_01)
    personal            TEXT,                                -- 개인 (NEEDS_02)
    operation           TEXT,                                -- 운영 (NEEDS_03)
    product             TEXT,                                -- 제품 (NEEDS_04)
    takeaway            TEXT,                                -- 시사점 (TAKEAWAY)
    followup_plan       TEXT,                                -- F/UP 계획 (FOLLOWUP)
    activity_plan       TEXT,                                -- 활동계획 (PLAN)
    gmail_id            VARCHAR(40),                         -- 유입 메일 Gmail 메시지 id (메일유입분만, dedup 키)
    ai_summary          TEXT,                                -- 로컬 LLM 3줄 요약(줄바꿈 구분). 폴러가 미리 생성
    ai_title            TEXT,                                -- 로컬 LLM 카드 제목('거래선, 핵심'). 백필이 미리 생성
    ai_tags             TEXT,                                -- 로컬 LLM 해시태그(쉼표 구분, 이슈/상태 중심). 백필이 미리 생성
    created_at          TIMESTAMP    DEFAULT NOW()           -- 레코드 적재일
);

-- 기존 테이블에 AI 컬럼을 나중에 추가하는 경우용(멱등)
ALTER TABLE sales_memo ADD COLUMN IF NOT EXISTS ai_title TEXT;
ALTER TABLE sales_memo ADD COLUMN IF NOT EXISTS ai_tags  TEXT;

-- 메일 유입분 중복 방지용 부분 유니크 인덱스 (xlsx 적재분은 gmail_id 가 NULL 이라 영향 없음)
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_memo_gmail_id
    ON sales_memo (gmail_id) WHERE gmail_id IS NOT NULL;
