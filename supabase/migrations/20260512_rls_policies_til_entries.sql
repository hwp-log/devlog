-- 0023: til_entries RLS 정식 정책 적용 (사용자 격리)
-- 0022 임시 정책(authenticated 전체 접근) - 20260511_create_til_entries.sql 제거 후 정식 정책 4개 작성

-- 임시 정책 제거
DROP POLICY "auth_users_full_access_temp" ON til_entries;

-- 정식 정책 4개 작성

-- SELECT: 본인 행만 조회 가능
CREATE POLICY "users_can_select_own_til" ON til_entries
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT: 본인 user_id로만 작성 가능
CREATE POLICY "users_can_insert_own_til" ON til_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: 본인 행만 수정 가능 + 다른 user_id로 변경 X
CREATE POLICY "users_can_update_own_til" ON til_entries
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: 본인 행만 삭제 가능
CREATE POLICY "users_can_delete_own_til" ON til_entries
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);