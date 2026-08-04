-- 0493 2단계: PlanSpot에 nullable Spot FK. 기존 35행은 전부 NULL(백필 없음).
--   onDelete SetNull — 스팟 청소(0208) 시 플랜 항목은 name으로 잔존(좌표는 3단계 전까지 0,0 하드코딩).
--   저장 경로는 아직 이 컬럼을 쓰지 않음(3단계) → 현행 동작 무변경.
ALTER TABLE "plan_spots" ADD COLUMN IF NOT EXISTS "spot_id" TEXT;
ALTER TABLE "plan_spots" ADD CONSTRAINT "plan_spots_spot_id_fkey"
  FOREIGN KEY ("spot_id") REFERENCES "spots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "plan_spots_spot_id_idx" ON "plan_spots"("spot_id");
