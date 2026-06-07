ALTER TABLE "likes" ENABLE ROW LEVEL SECURITY;

-- SELECT: 비로그인 포함 누구나 조회 가능
CREATE POLICY "likes_select" ON "likes"
FOR SELECT TO public
USING (true);

-- INSERT: 본인만 좋아요 추가 (user_id 위변조 방지)
CREATE POLICY "likes_insert" ON "likes"
FOR INSERT TO authenticated
WITH CHECK (user_id = (select auth.uid()));

-- DELETE: 본인만 좋아요 취소
CREATE POLICY "likes_delete" ON "likes"
FOR DELETE TO authenticated
USING (user_id = (select auth.uid()));
