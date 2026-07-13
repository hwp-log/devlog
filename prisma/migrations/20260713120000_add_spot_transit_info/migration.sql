-- Spot 교통 기준점 필드 (수동 입력 v1) — nullable 2열 추가, 기존 행 무영향
ALTER TABLE "spots"
  ADD COLUMN "nearest_station" TEXT,
  ADD COLUMN "transit_minutes" INTEGER;
