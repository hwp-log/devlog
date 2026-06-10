ALTER TABLE "plan_likes" ENABLE ROW LEVEL SECURITY;

-- SELECT: 비로그인 포함 누구나 조회 가능 (좋아요 수 집계용)
CREATE POLICY "plan_likes_select" ON "plan_likes"
FOR SELECT TO public
USING (true);

-- INSERT: 본인만 좋아요 추가
CREATE POLICY "plan_likes_insert" ON "plan_likes"
FOR INSERT TO authenticated
WITH CHECK (user_id = (select auth.uid()));

-- DELETE: 본인만 좋아요 취소
CREATE POLICY "plan_likes_delete" ON "plan_likes"
FOR DELETE TO authenticated
USING (user_id = (select auth.uid()));
