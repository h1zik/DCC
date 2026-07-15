-- DataForSEO Labs returns keyword_info.competition as a 0–1 ratio. Before this
-- migration the ingest helper divided that ratio by 100, so existing Labs rows
-- were stored at one hundredth of their intended value.
UPDATE "SeoKeyword"
SET "competition" = LEAST(1.0, "competition" * 100.0)
WHERE "source" IN ('dataforseo_labs', 'dataforseo_labs_related')
  AND "competition" IS NOT NULL
  AND "competition" >= 0.0
  AND "competition" <= 0.01;
