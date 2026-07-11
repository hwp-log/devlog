// 스팟 사진 Storage 정리 판정 유틸 (updateStoryAction 전용)
// extractStoragePath는 구 clearSpotPhoto 액션의 URL→경로 추출 로직 이관본.

const PUBLIC_PREFIX = '/storage/v1/object/public/story-photos/';

export function extractStoragePath(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);
    return url.pathname.startsWith(PUBLIC_PREFIX)
      ? url.pathname.slice(PUBLIC_PREFIX.length)
      : null;
  } catch {
    return null;
  }
}

export type PhotoIntent = 'clear' | 'replace' | 'keep';

export function resolvePhotoIntent(
  oldUrl: string | null,
  submittedUrl: string | null | undefined,
  hasPendingFile: boolean,
): PhotoIntent {
  if (hasPendingFile) return 'replace';
  // photoUrl:null + 파일 부재 = 비우기 의도의 파생 판정 (DB 스냅샷 vs 제출 payload의 diff 기반)
  if (oldUrl && !submittedUrl) return 'clear';
  return 'keep';
}
