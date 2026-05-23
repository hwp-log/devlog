-- SELECT: 모든 사람이 사진 조회 가능
CREATE POLICY "story_photos_select" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'story-photos');

-- INSERT: 로그인한 사람만 본인 폴더에 업로드 가능
CREATE POLICY "story_photos_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'story-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- UPDATE: 본인 업로드만 수정 가능 (USING + WITH CHECK로 이동 후 타인 폴더 변경 차단)
CREATE POLICY "story_photos_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'story-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'story-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE: 본인 업로드만 삭제 가능
CREATE POLICY "story_photos_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'story-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
