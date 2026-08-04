-- 0493 3단계: PlanSpot 좌표 nullable화 + 기존 가짜 0,0 정리.
--   lat/lng를 되살리는 트랙 — place 없는 항목은 좌표 부재를 NULL로 정직하게 표현(0,0 sentinel 폐기).
ALTER TABLE "plan_spots" ALTER COLUMN "lat" DROP NOT NULL;
ALTER TABLE "plan_spots" ALTER COLUMN "lng" DROP NOT NULL;
-- 기존 156행은 전부 place 없이 생성된 0,0(spot_id 전무·가짜값) → NULL 정리(백필 아님, 가짜 제거).
UPDATE "plan_spots" SET "lat" = NULL, "lng" = NULL WHERE "spot_id" IS NULL AND "lat" = 0 AND "lng" = 0;
