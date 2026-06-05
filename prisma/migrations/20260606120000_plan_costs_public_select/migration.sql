-- CreatePolicy: plan_costs 공개 SELECT (스토리에 연결된 플랜의 비용만)
CREATE POLICY "plan_costs_public_select" ON "plan_costs"
FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1 FROM stories
    WHERE stories.plan_id = plan_costs.plan_id
  )
);
