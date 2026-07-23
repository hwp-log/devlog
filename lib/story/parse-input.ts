import type { LocalSpot } from '@/lib/types';

// 입력 상한 — DB(text)는 무제약이라 앱단이 유일한 방어선 (값 확정: 0331)
export const MAX_TITLE_LEN = 100;
export const MAX_CONTENT_LEN = 20000; // Tiptap HTML 마크업 포함
export const MAX_TAGS = 5;            // 클라 캡(StoryWriteForm "N/5")과 일치
export const MAX_TAG_LEN = 20;
export const MAX_SPOTS = 20;          // tx 다수 쿼리 + 스팟당 외부 API 호출 보호
export const MAX_SPOT_NAME_LEN = 50;  // searchPlaces MAX_KEYWORD_LEN 선례

// 잘못된 payload는 500 대신 폼 에러로 — 파싱 실패·비배열·요소 타입 불일치 모두 null 수렴
export function parseTags(raw: string): string[] | null {
  try {
    const v = JSON.parse(raw || '[]');
    if (!Array.isArray(v) || !v.every((t) => typeof t === 'string')) return null;
    return v;
  } catch {
    return null;
  }
}

export function parseSpots(raw: string): LocalSpot[] | null {
  try {
    const v = JSON.parse(raw || '[]');
    if (!Array.isArray(v)) return null;
    for (const s of v) {
      // 최소 검증만: id(파일 키·tmp 매핑), name(길이 검증 대상), lat/lng(외부 API 인자)
      if (typeof s !== 'object' || s === null) return null;
      if (typeof s.id !== 'string' || typeof s.name !== 'string') return null;
      if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) return null;
    }
    return v as LocalSpot[];
  } catch {
    return null;
  }
}
