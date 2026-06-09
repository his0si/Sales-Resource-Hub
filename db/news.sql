-- ============================================================
-- 1. 원본 뉴스 테이블
-- ============================================================
-- 네이버 뉴스 API에서 수집한 원본 데이터를 저장
-- 이 테이블은 원칙적으로 수정하지 않음
CREATE TABLE IF NOT EXISTS raw_news_articles (
    id BIGSERIAL PRIMARY KEY,

    -- 기사를 수집한 시각
    collected_at_utc TIMESTAMPTZ,
    collected_at_kst TIMESTAMPTZ,

    -- 네이버 뉴스 검색 API를 호출할 때 사용한 검색 조건
    search_query TEXT NOT NULL,
    request_sort TEXT,
    filter_days INTEGER,

    -- 기사 발행 시각
    -- 네이버 뉴스 API의 pubDate를 파싱한 값
    published_at_utc TIMESTAMPTZ,
    published_at_kst TIMESTAMPTZ,

    -- 기사 원본 정보
    title TEXT NOT NULL,
    description TEXT,
    originallink TEXT,
    naverlink TEXT,

    -- 중복 적재를 막기 위한 해시값
    content_hash TEXT NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. 작업용 뉴스 테이블
-- ============================================================
-- raw_news_articles를 복사해서 만든 작업 테이블
-- 1단계 필터링, 중복 제거, 2단계 카테고리 분류 결과를 이 테이블에 업데이트
-- 매일 변경
CREATE TABLE IF NOT EXISTS working_news_articles (
    id BIGSERIAL PRIMARY KEY,

    -- 이 작업 행이 어떤 원본 기사에서 복사되었는지 추적
    -- raw_news_articles.id를 참조
    -- 원본 기사가 삭제되면 작업 행도 함께 삭제
    raw_article_id BIGINT NOT NULL REFERENCES raw_news_articles(id) ON DELETE CASCADE,

    collected_at_utc TIMESTAMPTZ,
    collected_at_kst TIMESTAMPTZ,
    
    search_query TEXT NOT NULL,
    request_sort TEXT,
    filter_days INTEGER,
    
    published_at_utc TIMESTAMPTZ,
    published_at_kst TIMESTAMPTZ,
    
    title TEXT NOT NULL,
    description TEXT,
    originallink TEXT,
    naverlink TEXT,

    content_hash TEXT NOT NULL,

    -- ========================================================
    -- 1단계 에이전트 결과: 관련성/중복 필터링
    -- ========================================================

    -- 1단계 에이전트의 관련성 판단 결과
    -- related: 관련 기사
    -- unrelated: 무관 기사
    -- uncertain: 판단이 애매한 기사
    -- duplicate: 중복 기사
    relevance_label TEXT,

    -- 1단계 에이전트가 판단한 세부 분류
    -- 예: hansol_home_deco, competitor, interior_trend, building_material 등
    relevance_category TEXT,

    -- 1단계 판단 신뢰도
    -- 0.000 ~ 1.000 범위를 사용
    relevance_confidence NUMERIC(4, 3),

    -- 1단계 판단 이유
    relevance_reason TEXT,

    -- TRUE면 제목/요약만으로 판단이 어려워 원문 확인이 필요한 기사
    needs_source_check BOOLEAN NOT NULL DEFAULT FALSE,

    -- 중복 기사인 경우 대표 작업 기사 ID를 저장
    -- 같은 이슈의 기사 중 하나만 남기고 나머지는 이 컬럼으로 대표 기사를 가리킴
    duplicate_of_working_article_id BIGINT REFERENCES working_news_articles(id) ON DELETE SET NULL,

    -- 최종적으로 작업 대상에 남길지 여부
    -- TRUE: 관련 기사 또는 보류 기사
    -- FALSE: 무관 기사 또는 중복 기사
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- 1단계 판단에 사용한 모델/에이전트 이름과 판단 시각
    relevance_judged_by TEXT,
    relevance_judged_at TIMESTAMPTZ,

    -- ========================================================
    -- 2단계 에이전트 결과: 최종 카테고리 분류
    -- ========================================================

    -- 2단계 에이전트가 부여한 대표 카테고리
    primary_category TEXT,

    -- 기사 하나가 두 카테고리에 명확히 걸쳐 있을 때 사용
    secondary_category TEXT,

    -- 2단계 카테고리 판단 신뢰도
    -- 0.000 ~ 1.000 범위를 사용
    category_confidence NUMERIC(4, 3),

    -- 2단계 카테고리 판단 이유입니다.
    category_reason TEXT,

    -- 2단계 판단에 사용한 모델/에이전트 이름과 판단 시각
    category_judged_by TEXT,
    category_judged_at TIMESTAMPTZ,

    -- ========================================================
    -- 파이프라인 상태 관리
    -- ========================================================

    -- 현재 처리 상태
    -- cloned: raw에서 working으로 복사됨
    -- relevance_done: 1단계 관련성 판단 완료
    -- source_checked: 원문 확인 완료
    -- deduplicated: 중복 제거 완료
    -- categorized: 2단계 카테고리 분류 완료
    -- failed: 처리 실패
    pipeline_status TEXT NOT NULL DEFAULT 'cloned',

    -- 처리 실패 시 에러 메시지를 저장
    error_message TEXT,

    -- 작업 행 생성/수정 시각
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 같은 원본 기사가 working 테이블에 중복으로 들어오지 않도록 막음
    CONSTRAINT uq_working_raw_article
        UNIQUE (raw_article_id),

    -- 1단계 관련성 판단값을 허용된 값으로 제한
    CONSTRAINT chk_relevance_label
        CHECK (
            relevance_label IS NULL
            OR relevance_label IN ('related', 'unrelated', 'uncertain', 'duplicate')
        ),

    -- 대표 카테고리를 허용된 카테고리 값으로 제한
    CONSTRAINT chk_primary_category
        CHECK (
            primary_category IS NULL
            OR primary_category IN (
                '신제품/MOU',
                '시장동향/건설경기',
                '경영/재무',
                '친환경/ESG',
                '유통/채널',
                '기타'
            )
        ),

    -- 보조 카테고리를 허용된 카테고리 값으로 제한
    CONSTRAINT chk_secondary_category
        CHECK (
            secondary_category IS NULL
            OR secondary_category IN (
                '신제품/MOU',
                '시장동향/건설경기',
                '경영/재무',
                '친환경/ESG',
                '유통/채널',
                '기타'
            )
        ),

    -- 파이프라인 상태값을 허용된 값으로 제한
    CONSTRAINT chk_pipeline_status
        CHECK (
            pipeline_status IN (
                'cloned',
                'relevance_done',
                'source_checked',
                'deduplicated',
                'categorized',
                'failed'
            )
        )
);

-- ============================================================
-- 3. 최근 7일치 working 테이블을 유지하는 함수
-- ============================================================
-- 동작:
-- 1. working_news_articles에서 최근 7일보다 오래된 기사 제거
-- 2. raw_news_articles에서 최근 7일 기사 중 working에 아직 없는 기사만 복사
--
-- 이 함수는 working 테이블을 전체 삭제하지 않음
-- 기존 6일치 작업 데이터는 유지하고, 7일 범위 밖으로 밀려난 오래된 기사만 제거
-- 매일 실행하면 working_news_articles는 항상 최근 7일치 작업 대상만 보관
-- SELECT * FROM refresh_working_news_recent_7days(); 명령어로 실행

CREATE OR REPLACE FUNCTION refresh_working_news_recent_7days()
RETURNS TABLE (
    deleted_count INTEGER,
    inserted_count INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- 1. 최근 7일 범위 밖의 오래된 working 기사 삭제
    DELETE FROM working_news_articles w
    WHERE w.published_at_kst < NOW() - INTERVAL '7 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- 2. raw에서 최근 7일 기사 중 아직 working에 없는 기사만 추가
    INSERT INTO working_news_articles (
        raw_article_id,
        collected_at_utc,
        collected_at_kst,
        search_query,
        request_sort,
        filter_days,
        published_at_utc,
        published_at_kst,
        title,
        description,
        originallink,
        naverlink,
        content_hash
    )
    SELECT
        r.id,
        r.collected_at_utc,
        r.collected_at_kst,
        r.search_query,
        r.request_sort,
        r.filter_days,
        r.published_at_utc,
        r.published_at_kst,
        r.title,
        r.description,
        r.originallink,
        r.naverlink,
        r.content_hash
    FROM raw_news_articles r
    WHERE r.published_at_kst >= NOW() - INTERVAL '7 days'
      AND NOT EXISTS (
          SELECT 1
          FROM working_news_articles w
          WHERE w.raw_article_id = r.id
      );

    GET DIAGNOSTICS inserted_count = ROW_COUNT;

    RETURN NEXT;
END;
$$;

-- ============================================================
-- 4. 인덱스
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_raw_news_content_hash
    ON raw_news_articles(content_hash);

CREATE INDEX IF NOT EXISTS idx_raw_news_published_at
    ON raw_news_articles(published_at_kst);

CREATE INDEX IF NOT EXISTS idx_raw_news_search_query
    ON raw_news_articles(search_query);

CREATE INDEX IF NOT EXISTS idx_working_news_raw_article_id
    ON working_news_articles(raw_article_id);

CREATE INDEX IF NOT EXISTS idx_working_news_pipeline_status
    ON working_news_articles(pipeline_status);

CREATE INDEX IF NOT EXISTS idx_working_news_is_active
    ON working_news_articles(is_active);

CREATE INDEX IF NOT EXISTS idx_working_news_relevance_label
    ON working_news_articles(relevance_label);

CREATE INDEX IF NOT EXISTS idx_working_news_primary_category
    ON working_news_articles(primary_category);

CREATE INDEX IF NOT EXISTS idx_working_news_secondary_category
    ON working_news_articles(secondary_category);