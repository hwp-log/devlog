-- 0199 B2: StorySpot.rating (per-visit 별점 1~5). Spot의 ★는 이 rating들의 평균(파생).
-- nullable — 별점 미기입 허용. 시딩 스팟엔 주입 안 함(아무도 안 다녀감 → null이 정직). 재실행 안전.
ALTER TABLE "story_spots" ADD COLUMN IF NOT EXISTS "rating" INTEGER;
