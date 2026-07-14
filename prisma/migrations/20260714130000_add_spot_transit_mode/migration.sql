-- transitMode: 거리 기반 도보/차로 판정 도입으로 수단이 기준점 이름에서 파생 불가능해져 저장.
-- (transit.ts 주석이 예고한 "파생 불가능해지는 순간 저장이 정당해지는 시점")
-- 값: 'walk' | 'car'. nullable — 기존 행은 null → formatTransit이 기존 이름 규칙으로 폴백.
-- 백필 없음(개선 적용 후 별도 사이클). 재실행 안전(IF NOT EXISTS).

ALTER TABLE "spots" ADD COLUMN IF NOT EXISTS "transit_mode" TEXT;
