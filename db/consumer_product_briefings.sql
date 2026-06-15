-- Step 3 제품별 소비자 브리핑 저장 테이블입니다.
-- period_start 이상, period_end 미만 기간의 resolved 제품 언급을 요약합니다.

CREATE TABLE IF NOT EXISTS cp_briefing (
  id bigserial PRIMARY KEY,
  product_id bigint NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  mention_count integer NOT NULL DEFAULT 0,
  positive_count integer NOT NULL DEFAULT 0,
  negative_count integer NOT NULL DEFAULT 0,
  neutral_count integer NOT NULL DEFAULT 0,
  overall_summary text NOT NULL,
  positive_feedback jsonb NOT NULL DEFAULT '[]'::jsonb,
  negative_feedback jsonb NOT NULL DEFAULT '[]'::jsonb,
  briefing jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_consumer_product_briefing_period CHECK (period_start < period_end),
  CONSTRAINT uq_consumer_product_briefing_period UNIQUE (product_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_consumer_product_briefing_period
  ON cp_briefing(period_start, period_end);
