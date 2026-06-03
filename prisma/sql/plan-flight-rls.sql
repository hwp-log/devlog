-- ── plan_flights ──────────────────────────────────────────────────────────────
ALTER TABLE "plan_flights" ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 계획의 항공편만 조회 가능
CREATE POLICY "plan_flights_select" ON "plan_flights"
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM my_plans
    WHERE my_plans.id = plan_flights.plan_id
      AND my_plans.owner_id = (select auth.uid())
  )
);

-- INSERT: 본인 계획에만 항공편 추가 가능
CREATE POLICY "plan_flights_insert" ON "plan_flights"
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM my_plans
    WHERE my_plans.id = plan_flights.plan_id
      AND my_plans.owner_id = (select auth.uid())
  )
);

-- UPDATE: 본인 계획의 항공편만 수정 가능
CREATE POLICY "plan_flights_update" ON "plan_flights"
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM my_plans
    WHERE my_plans.id = plan_flights.plan_id
      AND my_plans.owner_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM my_plans
    WHERE my_plans.id = plan_flights.plan_id
      AND my_plans.owner_id = (select auth.uid())
  )
);

-- DELETE: 본인 계획의 항공편만 삭제 가능
CREATE POLICY "plan_flights_delete" ON "plan_flights"
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM my_plans
    WHERE my_plans.id = plan_flights.plan_id
      AND my_plans.owner_id = (select auth.uid())
  )
);
