-- ── my_plans ──────────────────────────────────────────────────────────────────
ALTER TABLE "my_plans" ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 계획만 조회 가능
CREATE POLICY "my_plans_select" ON "my_plans"
FOR SELECT TO authenticated
USING (owner_id = (select auth.uid()));

-- INSERT: 본인만 생성 가능
CREATE POLICY "my_plans_insert" ON "my_plans"
FOR INSERT TO authenticated
WITH CHECK (owner_id = (select auth.uid()));

-- UPDATE: 본인만 수정 가능
CREATE POLICY "my_plans_update" ON "my_plans"
FOR UPDATE TO authenticated
USING  (owner_id = (select auth.uid()))
WITH CHECK (owner_id = (select auth.uid()));

-- DELETE: 본인만 삭제 가능
CREATE POLICY "my_plans_delete" ON "my_plans"
FOR DELETE TO authenticated
USING (owner_id = (select auth.uid()));


-- ── plan_spots ────────────────────────────────────────────────────────────────
ALTER TABLE "plan_spots" ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 계획의 스팟만 조회 가능
CREATE POLICY "plan_spots_select" ON "plan_spots"
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM my_plans
    WHERE my_plans.id = plan_spots.plan_id
    AND my_plans.owner_id = (select auth.uid())
  )
);

-- INSERT: 본인 계획에만 스팟 추가 가능
CREATE POLICY "plan_spots_insert" ON "plan_spots"
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM my_plans
    WHERE my_plans.id = plan_spots.plan_id
    AND my_plans.owner_id = (select auth.uid())
  )
);

-- UPDATE: 본인 계획의 스팟만 수정 가능
CREATE POLICY "plan_spots_update" ON "plan_spots"
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM my_plans
    WHERE my_plans.id = plan_spots.plan_id
    AND my_plans.owner_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM my_plans
    WHERE my_plans.id = plan_spots.plan_id
    AND my_plans.owner_id = (select auth.uid())
  )
);

-- DELETE: 본인 계획의 스팟만 삭제 가능
CREATE POLICY "plan_spots_delete" ON "plan_spots"
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM my_plans
    WHERE my_plans.id = plan_spots.plan_id
    AND my_plans.owner_id = (select auth.uid())
  )
);


-- ── plan_costs ────────────────────────────────────────────────────────────────
ALTER TABLE "plan_costs" ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 계획의 비용만 조회 가능
CREATE POLICY "plan_costs_select" ON "plan_costs"
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM my_plans
    WHERE my_plans.id = plan_costs.plan_id
    AND my_plans.owner_id = (select auth.uid())
  )
);

-- INSERT: 본인 계획에만 비용 추가 가능
CREATE POLICY "plan_costs_insert" ON "plan_costs"
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM my_plans
    WHERE my_plans.id = plan_costs.plan_id
    AND my_plans.owner_id = (select auth.uid())
  )
);

-- UPDATE: 본인 계획의 비용만 수정 가능
CREATE POLICY "plan_costs_update" ON "plan_costs"
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM my_plans
    WHERE my_plans.id = plan_costs.plan_id
    AND my_plans.owner_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM my_plans
    WHERE my_plans.id = plan_costs.plan_id
    AND my_plans.owner_id = (select auth.uid())
  )
);

-- DELETE: 본인 계획의 비용만 삭제 가능
CREATE POLICY "plan_costs_delete" ON "plan_costs"
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM my_plans
    WHERE my_plans.id = plan_costs.plan_id
    AND my_plans.owner_id = (select auth.uid())
  )
);

-- SELECT (공개): 스토리에 연결된 플랜의 비용은 누구나 조회 가능
-- 기존 plan_costs_select(owner용) 정책은 유지
CREATE POLICY "plan_costs_public_select" ON "plan_costs"
FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1 FROM stories
    WHERE stories.plan_id = plan_costs.plan_id
  )
);
