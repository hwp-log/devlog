-- SELECT: 모든 사람이 아바타 조회 가능 (퍼블릭 프사)
CREATE POLICY "avatars_select" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'avatars');

-- INSERT: 로그인한 사람만 본인 폴더에 업로드 가능
CREATE POLICY "avatars_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- UPDATE: 본인 업로드만 수정 (USING + WITH CHECK 양쪽으로 폴더 이동 공격 차단)
CREATE POLICY "avatars_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE: 본인 업로드만 삭제
CREATE POLICY "avatars_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
