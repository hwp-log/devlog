-- 0189 per-link: SpotMovie.description 추가.
-- RELATE_PLACE_DC(촬영 장면 설명)는 per-(장소,작품)이라 Spot이 아닌 조인에 붙는다.
-- (B1 per-place/per-visit 분리와 같은 층 — 이번엔 per-link)
-- nullable: 설명 없는 링크 허용. 백필 없음(시딩은 0190 별도). 재실행 안전(IF NOT EXISTS).

ALTER TABLE "spot_movies" ADD COLUMN IF NOT EXISTS "description" TEXT;
