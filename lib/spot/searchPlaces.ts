'use server';
import { createClient } from '@/lib/supabase/server';

// 키워드 장소 검색 — Kakao Local REST(keyword.json). 지도 SDK는 Naver로 이식했지만
// 장소 검색은 카카오 REST 유지(autoTransit.ts 선례·기존 KAKAO_REST_API_KEY 재사용).
// x=lng/y=lat 변환을 서버에서 완료해 클라(SpotMap)엔 순수 {lat,lng} 숫자만 내려보낸다.

const KAKAO_LOCAL_BASE = 'https://dapi.kakao.com/v2/local/search';
const TIMEOUT_MS = 5000;
// 검색어 상한 — 실존 장소명은 50자를 넘지 않음. 초과 = 비정상 입력이라 zero("결과 없음")가
// 사실에 부합. slice 검색은 잘린 쿼리로 왜곡된 결과를 조용히 반환하므로 기각.
const MAX_KEYWORD_LEN = 50;

export type PlaceResult = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export type SearchPlacesResult =
  | { status: 'ok'; places: PlaceResult[] }
  | { status: 'zero' }
  | { status: 'error' };

type KakaoDoc = { id: string; place_name: string; address_name: string; x: string; y: string };

export async function searchPlaces(keyword: string): Promise<SearchPlacesResult> {
  const kw = keyword.trim();
  if (!kw || kw.length > MAX_KEYWORD_LEN) return { status: 'zero' };

  // 공개 엔드포인트 노출 방어 — 미인증 호출로 Kakao 쿼터 소진 방지 (til/actions 값 반환형 패턴).
  // 사유 미노출: 기존 3상태 유지, error로 수렴 (글쓰기 화면 자체가 로그인 필수라 정상 사용자 무영향)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'error' };

  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    console.error('[searchPlaces] KAKAO_REST_API_KEY 미설정');
    return { status: 'error' };
  }
  try {
    const qs = new URLSearchParams({ query: kw, size: '15' });
    const res = await fetch(`${KAKAO_LOCAL_BASE}/keyword.json?${qs}`, {
      headers: { Authorization: `KakaoAK ${key}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`kakao local keyword HTTP ${res.status}`);
    const json = (await res.json()) as { documents: KakaoDoc[] };
    const places = json.documents
      .map((d) => ({
        id: d.id,
        name: d.place_name,
        address: d.address_name,
        lng: parseFloat(d.x), // x = 경도(lng) ★★★
        lat: parseFloat(d.y), // y = 위도(lat) ★★★
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    return places.length > 0 ? { status: 'ok', places } : { status: 'zero' };
  } catch (e) {
    console.error('[searchPlaces] 검색 실패', e);
    return { status: 'error' };
  }
}
