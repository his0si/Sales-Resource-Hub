-- 제품 언급 결과 테이블입니다.
-- resolved 행은 어떤 콘텐츠가 어떤 product_id를 언급했는지 확정된 결과입니다.
-- unresolved 행은 제품명은 발견했지만 product_id를 확정하지 못한 후보입니다.
-- ignored 행은 제품명 문자열은 걸렸지만 한솔홈데코 제품 언급이 아니라고 판단한 후보입니다.

CREATE TABLE IF NOT EXISTS consumer_product (
  id bigserial PRIMARY KEY,
  content_id bigint NOT NULL REFERENCES raw_consumer_trend(id) ON DELETE CASCADE,
  product_id bigint REFERENCES product(id) ON DELETE CASCADE,
  mentioned_name text,
  resolve_status text NOT NULL DEFAULT 'resolved',
  context text,
  candidate_products jsonb,
  resolve_reason text,
  positive boolean NOT NULL DEFAULT false,
  negative boolean NOT NULL DEFAULT false,
  neutral boolean NOT NULL DEFAULT false,
  mixed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE consumer_product
  DROP CONSTRAINT IF EXISTS consumer_product_resolve_status_check;

ALTER TABLE consumer_product
  ADD CONSTRAINT consumer_product_resolve_status_check
  CHECK (resolve_status IN ('resolved', 'unresolved', 'ignored'));

ALTER TABLE consumer_product
  DROP CONSTRAINT IF EXISTS chk_consumer_product_resolve_fields;

ALTER TABLE consumer_product
  ADD CONSTRAINT chk_consumer_product_resolve_fields CHECK (
    (resolve_status = 'resolved' AND product_id IS NOT NULL)
    OR
    (
      resolve_status IN ('unresolved', 'ignored')
      AND product_id IS NULL
      AND mentioned_name IS NOT NULL
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_consumer_product_resolved
  ON consumer_product(content_id, product_id)
  WHERE resolve_status = 'resolved';

CREATE UNIQUE INDEX IF NOT EXISTS uq_consumer_product_unresolved_ignored
  ON consumer_product(content_id, mentioned_name, resolve_status)
  WHERE resolve_status IN ('unresolved', 'ignored');

CREATE INDEX IF NOT EXISTS idx_consumer_product_content_id
  ON consumer_product(content_id);

CREATE INDEX IF NOT EXISTS idx_consumer_product_product_id
  ON consumer_product(product_id)
  WHERE resolve_status = 'resolved';



