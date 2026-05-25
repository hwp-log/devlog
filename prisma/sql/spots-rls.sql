-- RLS 활성화
ALTER TABLE "spots" ENABLE ROW LEVEL SECURITY;

-- SELECT: 모든 사람이 스팟 조회 가능
CREATE POLICY "spots_select" ON "spots"
FOR SELECT TO public
USING (true);

-- INSERT: Story 소유자만 스팟 추가 가능
CREATE POLICY "spots_insert" ON "spots"
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM stories
    WHERE stories.id = spots.story_id
    AND stories.user_id = (select auth.uid())
  )
);

-- UPDATE: Story 소유자만 스팟 수정 가능 (USING + WITH CHECK 양쪽)
CREATE POLICY "spots_update" ON "spots"
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stories
    WHERE stories.id = spots.story_id
    AND stories.user_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM stories
    WHERE stories.id = spots.story_id
    AND stories.user_id = (select auth.uid())
  )
);

-- DELETE: Story 소유자만 스팟 삭제 가능
CREATE POLICY "spots_delete" ON "spots"
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stories
    WHERE stories.id = spots.story_id
    AND stories.user_id = (select auth.uid())
  )
);
