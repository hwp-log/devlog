-- 0403: MyPlan 카드 인원수(headcount)·지역 대표 커버(coverUrl).
-- headcount NOT NULL DEFAULT 1 → 기존 행 자동 1. coverUrl nullable → 기존 행 null.
-- 이번 커밋은 컬럼 추가만(화면·로직 없음). 재실행 안전(IF NOT EXISTS).
ALTER TABLE "my_plans" ADD COLUMN IF NOT EXISTS "headcount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "my_plans" ADD COLUMN IF NOT EXISTS "cover_url" TEXT;
