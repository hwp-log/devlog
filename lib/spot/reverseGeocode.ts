import 'server-only';

// 좌표 → 주소 역지오코딩 (스팟 추가 시 1회) — 카카오 로컬 coord2address.
// autoTransit.ts와 동일 경계: 같은 KAKAO_REST_API_KEY, server-only, 어떤 실패도 throw 없이 null
// (0178 실패 허용 — 주소가 없어도 스팟 추가·저장을 막지 않는다).
// 도로명(road_address) 우선 + 없으면 지번(address) 폴백 — 0391의 검색 주소 도로명 우선 규칙과 통일.
// road_address는 일부 좌표(신축·비주소 지역)에서 null이라 || 폴백 필수.

const KAKAO_COORD2ADDRESS = 'https://dapi.kakao.com/v2/local/geo/coord2address.json';
const TIMEOUT_MS = 3000;

type Coord2AddressDoc = {
  road_address: { address_name: string } | null;
  address: { address_name: string } | null;
};

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    console.error('[reverseGeocode] KAKAO_REST_API_KEY 미설정 — 역지오코딩 생략');
    return null;
  }
  try {
    const qs = new URLSearchParams({ x: String(lng), y: String(lat) }); // x=lng, y=lat ★★★
    const res = await fetch(`${KAKAO_COORD2ADDRESS}?${qs}`, {
      headers: { Authorization: `KakaoAK ${key}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`kakao coord2address HTTP ${res.status}`);
    const json = (await res.json()) as { documents: Coord2AddressDoc[] };
    const doc = json.documents[0];
    if (!doc) return null;
    // 도로명 우선, 없으면 지번. 둘 다 빈/null이면 null (|| 로 빈 문자열도 흡수).
    return doc.road_address?.address_name || doc.address?.address_name || null;
  } catch (e) {
    console.error('[reverseGeocode] 역지오코딩 실패', e);
    return null;
  }
}
