-- 0504 1단계: PlanCost.day nullable화 — 하루에 속하지 않는 비용(렌터카·항공권·보험 등) 저장 허용.
--   기존 행은 전부 day 값 보유 → 백필 없음(제약만 완화).
ALTER TABLE "plan_costs" ALTER COLUMN "day" DROP NOT NULL;
