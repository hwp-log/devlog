-- RLS 활성화
ALTER TABLE "story_spots" ENABLE ROW LEVEL SECURITY;

-- SELECT: 모든 사람이 조회 가능
CREATE POLICY "story_spots_select" ON "story_spots"
FOR SELECT TO public
USING (true);

-- INSERT: Story 소유자만 추가 가능
CREATE POLICY "story_spots_insert" ON "story_spots"
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM stories
    WHERE stories.id = story_spots.story_id
    AND stories.user_id = (select auth.uid())
  )
);

-- UPDATE: Story 소유자만 수정 가능 (USING + WITH CHECK 양쪽)
CREATE POLICY "story_spots_update" ON "story_spots"
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stories
    WHERE stories.id = story_spots.story_id
    AND stories.user_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM stories
    WHERE stories.id = story_spots.story_id
    AND stories.user_id = (select auth.uid())
  )
);

-- DELETE: Story 소유자만 삭제 가능
CREATE POLICY "story_spots_delete" ON "story_spots"
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stories
    WHERE stories.id = story_spots.story_id
    AND stories.user_id = (select auth.uid())
  )
);
