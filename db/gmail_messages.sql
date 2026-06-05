-- ============================================================
-- gmail_messages : Gmail 메일 캐시 테이블
--   Gmail API 호출이 성공하면 받은 메일을 이 테이블에 자동 저장(upsert)하고,
--   API 가 막히면(예: OAuth client disabled) 이 테이블의 자료를 대신 보여준다.
--   실행: PGPASSWORD=<pw> psql -h 127.0.0.1 -p 5433 -U hansolax -d hansolax -f db/gmail_messages.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS gmail_messages (
    id            VARCHAR(40)  PRIMARY KEY,        -- Gmail 메시지 id
    thread_id     VARCHAR(40),                     -- 스레드 id
    mailbox       VARCHAR(255),                    -- 메일 계정(gmail_mailbox)
    from_addr     TEXT,                            -- 보낸이 (From 헤더)
    subject       TEXT,                            -- 제목 (Subject 헤더)
    date_raw      TEXT,                            -- 날짜 헤더 원문 (프론트가 파싱)
    internal_date TIMESTAMP,                       -- 정렬용 수신 시각 (Gmail internalDate)
    snippet       TEXT,                            -- 미리보기
    unread        BOOLEAN     DEFAULT FALSE,       -- 읽지 않음 여부
    body          TEXT,                            -- 추출한 본문(텍스트)
    fetched_at    TIMESTAMP   DEFAULT NOW()        -- 마지막으로 캐시한 시각
);

CREATE INDEX IF NOT EXISTS idx_gmail_messages_internal_date
    ON gmail_messages (internal_date DESC);
