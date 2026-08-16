-- 0588: PlanCost 순서 정본. created_at은 "삽입 순서"일 뿐 "사용자가 정한 순서"가 아니라,
--   드래그 정렬을 붙이는 순간 둘이 갈린다. (조사 실측: Prisma가 @default(now())를 행마다
--   클라이언트 측에서 생성해 보내므로 DB DEFAULT CURRENT_TIMESTAMP는 쓰이지 않았고,
--   같은 (plan_id, day, created_at) 중복 그룹은 0건이었다 — 즉 기존 정렬이 깨져 있진 않았다.)
--
--   순번 공간은 (plan_id, day) 그룹별 — day=null인 고정 비용이 Postgres PARTITION에서
--   한 그룹으로 묶이고, 폼의 두 배열(daylessCosts / dayCosts) 분리와도 맞는다.
ALTER TABLE "plan_costs" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- 백필: 현재 화면 순서를 그대로 굳힌다(created_at 순). id는 동률 방지용 2차 키.
UPDATE "plan_costs" c SET "order" = s.rn
FROM (
  SELECT id, row_number() OVER (PARTITION BY plan_id, day ORDER BY created_at, id) - 1 AS rn
  FROM "plan_costs"
) s
WHERE c.id = s.id;

-- PlanSpot.order와 형태를 맞춘다(그쪽도 DEFAULT 없음) — 저장 경로가 항상 명시적으로 넣는다.
ALTER TABLE "plan_costs" ALTER COLUMN "order" DROP DEFAULT;

CREATE INDEX "plan_costs_plan_id_day_order_idx" ON "plan_costs"("plan_id", "day", "order");
