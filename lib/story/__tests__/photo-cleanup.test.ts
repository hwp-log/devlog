import { extractStoragePath, resolvePhotoIntent } from '../photo-cleanup';

describe('extractStoragePath', () => {
  it('should extract storage path from story-photos public url', () => {
    const url =
      'https://xyz.supabase.co/storage/v1/object/public/story-photos/user1/spot/spot1/123.png';
    expect(extractStoragePath(url)).toBe('user1/spot/spot1/123.png');
  });

  it('should return null for blob url', () => {
    expect(extractStoragePath('blob:http://localhost:3000/abc-def')).toBeNull();
  });

  it('should return null for non-url string', () => {
    expect(extractStoragePath('not-a-url')).toBeNull();
  });

  it('should return null for other bucket public url', () => {
    const url =
      'https://xyz.supabase.co/storage/v1/object/public/other-bucket/user1/file.png';
    expect(extractStoragePath(url)).toBeNull();
  });
});

describe('resolvePhotoIntent — 비우기/교체 판정표', () => {
  const OLD = 'https://xyz.supabase.co/storage/v1/object/public/story-photos/u/spot/s/1.png';

  it('① 비우기: DB non-null + 제출 null + 파일 없음 → clear', () => {
    expect(resolvePhotoIntent(OLD, null, false)).toBe('clear');
  });

  it('② 교체: 파일 있음 → replace (제출 photoUrl 값과 무관)', () => {
    expect(resolvePhotoIntent(OLD, 'blob:http://localhost/x', true)).toBe('replace');
  });

  it("②' 추가: DB null + 파일 있음 → replace (구 파일 없음은 호출부에서 처리)", () => {
    expect(resolvePhotoIntent(null, 'blob:http://localhost/x', true)).toBe('replace');
  });

  it('③ 무변경: DB와 제출 동일 non-null + 파일 없음 → keep', () => {
    expect(resolvePhotoIntent(OLD, OLD, false)).toBe('keep');
  });

  it('③ 무변경: DB null + 제출 null + 파일 없음 → keep (비우기 아님)', () => {
    expect(resolvePhotoIntent(null, null, false)).toBe('keep');
  });

  it('④ 연속 조작 수렴 — 교체 후 비우기: 최종 상태(null + 파일 없음)만 판정 → clear', () => {
    // 클라이언트가 onFileSelect(null)로 pendingPhotos에서 제거 + photoUrl null 제출
    expect(resolvePhotoIntent(OLD, null, false)).toBe('clear');
  });

  it('④ 연속 조작 수렴 — 비우기 후 교체: 최종 상태(파일 있음)만 판정 → replace', () => {
    expect(resolvePhotoIntent(OLD, 'blob:http://localhost/y', true)).toBe('replace');
  });

  it('제출 undefined도 null과 동일하게 비우기로 판정', () => {
    expect(resolvePhotoIntent(OLD, undefined, false)).toBe('clear');
  });
});
