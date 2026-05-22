-- users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_all" ON users FOR SELECT USING (true);
CREATE POLICY "users_insert_own" ON users FOR INSERT
  WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update_own" ON users FOR UPDATE
  USING (auth.uid() = id);

-- stories
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stories_read_all" ON stories FOR SELECT USING (true);
CREATE POLICY "stories_insert_own" ON stories FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stories_update_own" ON stories FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "stories_delete_own" ON stories FOR DELETE
  USING (auth.uid() = user_id);

-- tags
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags_read_all" ON tags FOR SELECT USING (true);
CREATE POLICY "tags_insert_authenticated" ON tags FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- _StoryToTag (Prisma 자동 생성 다대다 조인 테이블)
ALTER TABLE "_StoryToTag" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "story_tag_read_all" ON "_StoryToTag" FOR SELECT USING (true);
CREATE POLICY "story_tag_insert_own" ON "_StoryToTag" FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM stories WHERE id = "A")
  );
CREATE POLICY "story_tag_delete_own" ON "_StoryToTag" FOR DELETE
  USING (
    auth.uid() = (SELECT user_id FROM stories WHERE id = "A")
  );
