-- 네이버 셀프인테리어 카페와 오늘의집에서 수집한 소비자 인테리어 트렌드 원천 데이터 테이블
CREATE TABLE IF NOT EXISTS raw_consumer_trend (
    id          BIGSERIAL PRIMARY KEY,

    -- 데이터 출처. 예: self_in, ohou
    source      VARCHAR(50)  NOT NULL,

    -- 원본 사이트에서 사용하는 게시글 또는 콘텐츠 ID
    content_id  VARCHAR(100) NOT NULL,

    -- 게시글 또는 콘텐츠 제목
    title       TEXT,

    -- 게시글 또는 콘텐츠 본문
    content     TEXT,

    -- 콘텐츠 작성일시
    created_at  TIMESTAMP,

    -- 콘텐츠 URL
    url         TEXT,

    -- 원본 사이트에서 수집한 좋아요 수
    likes       INTEGER DEFAULT 0,

    -- 같은 출처의 같은 원본 콘텐츠가 중복 저장되지 않도록 제한
    CONSTRAINT uq_raw_consumer_trend_source_content_id UNIQUE (source, content_id),

    -- 좋아요 수는 음수가 될 수 없음
    CONSTRAINT chk_raw_consumer_trend_likes_non_negative CHECK (likes IS NULL OR likes >= 0)
);

-- 출처별 조회 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_raw_consumer_trend_source
    ON raw_consumer_trend (source);

-- 작성일시 기준 정렬 및 기간 조회 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_raw_consumer_trend_created_at
    ON raw_consumer_trend (created_at);