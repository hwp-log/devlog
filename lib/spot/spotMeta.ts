'use server';
import { createClient } from '@/lib/supabase/server';
import { reverseGeocode } from './reverseGeocode';
import { findNearestTransit } from './autoTransit';

// 0392: 스팟 추가 시 좌표 한 왕복으로 주소·교통을 함께 받아오는 클라 호출 액션.
// 주소=역지오코딩(reverseGeocode) / 교통=기존 findNearestTransit 재사용. 각 실패는 독립 null 흡수
// (0178 — 부분 실패가 전체를 막지 않게). 저장 시 계산은 actions.ts가 백스톱으로 유지.

// 'use server' 모듈은 async 함수만 export 가능 → 타입은 로컬(비export). 클라는 구조 호환 shape로 소비.
type SpotMeta = {
  address: string | null;
  nearestStation: string | null;
  transitMinutes: number | null;
  transitMode: string | null;
};

const EMPTY: SpotMeta = { address: null, nearestStation: null, transitMinutes: null, transitMode: null };

export async function getSpotMeta(
  lat: number,
  lng: number,
  opts?: { includeAddress?: boolean },
): Promise<SpotMeta> {
  // 0384 throw 가드형 — 외부 API를 태우는 액션이라 미인증 호출은 쿼터 소진 경로. 조회 전 차단.
  // (nearby.ts와 동일 계약: 'UNAUTHENTICATED' throw. 공용 requireUser 추출은 후속 리팩터로 보류)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('UNAUTHENTICATED');

  // 좌표 검증 — 0384 Number.isFinite 교훈. 비유한·범위 밖은 clamp가 무의미(좌표라) → 거부(전 필드 null).
  const valid =
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  if (!valid) return EMPTY;

  const includeAddress = opts?.includeAddress ?? true;
  const [address, transit] = await Promise.all([
    includeAddress ? reverseGeocode(lat, lng) : Promise.resolve(null),
    findNearestTransit(lat, lng),
  ]);
  return {
    address,
    nearestStation: transit?.nearestStation ?? null,
    transitMinutes: transit?.transitMinutes ?? null,
    transitMode: transit?.transitMode ?? null,
  };
}
