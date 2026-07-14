import 'server-only';
import { haversineM } from './geo';

// 교통 기준점 자동 계산 (스팟 저장 시 1회) — 카카오 로컬 REST API.
// 채택 근거: NCP/네이버엔 좌표+반경+카테고리 POI 검색 API 부재, NCP Directions는 자동차
// 전용(도보 미지원 공식) → 검색은 카카오 로컬, 소요분은 직선거리 추정("약 N분" 표기).
// 실패 허용이 원칙: 어떤 실패도 throw 하지 않고 null — 스토리 저장을 절대 막지 않는다.

const KAKAO_LOCAL_BASE = 'https://dapi.kakao.com/v2/local/search';
const TIMEOUT_MS = 3000;

// 직선거리 → 분 추정 계수 (판단값): 도보 4km/h ≈ 67m/min × 경로계수 1.3 / 차로 40km/h ≈ 667m/min × 1.4
const WALK = { mPerMin: 67, detour: 1.3 };
const DRIVE = { mPerMin: 667, detour: 1.4 };

// 도보/차로 경계 = 지하철 검색 반경(2km "도보권") 재사용 — 단일 소스. ≤2km 도보, 초과 차로.
const WALK_MAX_M = 2000;
// 비현실 컷오프: 차로 환산 90분(≈43km) 초과면 "가장 가까운 교통"이 무의미 → 포기(null).
// "잘못된 정보보다 없는 정보가 낫다" (0178 실패=null 허용 원칙). 도보는 ≤2km라 이 선에 안 걸림.
const MAX_TRANSIT_MIN = 90;

// 공항은 검색이 아니라 정적 목록 (실측 근거: 카카오 키워드 "공항"/"국제공항" 상위 15개가
// 중개사·렌터카·공항주차장 등으로 채워져 공항 본체가 안 잡힘 — 국내 민간 공항은 15곳,
// 수십 년 단위 변동이라 정적 데이터가 정확·안정·API 0콜)
const AIRPORTS: Array<{ name: string; lat: number; lng: number }> = [
  { name: '인천국제공항', lat: 37.4602, lng: 126.4407 },
  { name: '김포국제공항', lat: 37.5583, lng: 126.7906 },
  { name: '제주국제공항', lat: 33.5113, lng: 126.493 },
  { name: '김해국제공항', lat: 35.1795, lng: 128.9382 },
  { name: '대구국제공항', lat: 35.8941, lng: 128.6589 },
  { name: '청주국제공항', lat: 36.7166, lng: 127.499 },
  { name: '광주공항', lat: 35.1264, lng: 126.8089 },
  { name: '무안국제공항', lat: 34.9914, lng: 126.3828 },
  { name: '양양국제공항', lat: 38.0613, lng: 128.6692 },
  { name: '여수공항', lat: 34.8423, lng: 127.6157 },
  { name: '울산공항', lat: 35.5935, lng: 129.3517 },
  { name: '사천공항', lat: 35.0886, lng: 128.0702 },
  { name: '포항경주공항', lat: 35.9879, lng: 129.4205 },
  { name: '군산공항', lat: 35.9038, lng: 126.6159 },
  { name: '원주공항', lat: 37.4412, lng: 127.96 },
];


type KakaoPlace = { place_name: string; distance: string; category_name: string };

async function kakaoSearch(path: string, params: Record<string, string>): Promise<KakaoPlace[]> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    console.error('[autoTransit] KAKAO_REST_API_KEY 미설정 — 자동 계산 생략');
    return [];
  }
  const qs = new URLSearchParams({ ...params, sort: 'distance', size: '15' });
  const res = await fetch(`${KAKAO_LOCAL_BASE}/${path}?${qs}`, {
    headers: { Authorization: `KakaoAK ${key}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`kakao local ${path} HTTP ${res.status}`);
  const json = (await res.json()) as { documents: KakaoPlace[] };
  return json.documents;
}

function toMinutes(distanceMeters: number, { mPerMin, detour }: { mPerMin: number; detour: number }): number {
  return Math.max(1, Math.round((distanceMeters * detour) / mPerMin));
}

export async function findNearestTransit(
  lat: number,
  lng: number
): Promise<{ nearestStation: string; transitMinutes: number; transitMode: 'walk' | 'car' } | null> {
  const xy = { x: String(lng), y: String(lat) };
  try {
    // 기준점 이름 + 직선거리를 캐스케이드로 확정 → 수단·소요분은 거리에서 파생 (아래 공통 처리)
    let station: string;
    let distanceM: number;

    // 1) 지하철역 (SW8) 반경 2km = 도보권. place_name의 노선 접미사("서울역 GTX-A") 제거 (실측 정제)
    const subway = (await kakaoSearch('category.json', { ...xy, category_group_code: 'SW8', radius: '2000' }))[0];
    if (subway) {
      station = subway.place_name.split(' ')[0];
      distanceM = Number(subway.distance);
    } else {
      // 2) 기차역 키워드 반경 20km (KTX역 등은 SW8 미포함 — 강릉역류).
      // 오탐·비승객역 제외 (실측 근거): category_name에 기차/철도 포함 AND 폐역 제외,
      // place_name에 화물·신호장·조차장·예정 미포함 (화물역은 category가 일반 기차역과 동일 → 이름으로만 구분)
      const rail = (await kakaoSearch('keyword.json', { ...xy, query: '기차역', radius: '20000' }))
        .find((p) =>
          (p.category_name.includes('기차') || p.category_name.includes('철도')) &&
          !p.category_name.includes('폐역') &&
          !/화물|신호장|조차장|예정/.test(p.place_name));
      if (rail) {
        station = rail.place_name;
        distanceM = Number(rail.distance);
      } else {
        // 3) 공항 — 정적 목록에서 하버사인 최근접 (상단 AIRPORTS 주석 참조, API 미사용)
        let nearest = AIRPORTS[0];
        let nearestDist = haversineM(lat, lng, nearest.lat, nearest.lng);
        for (const a of AIRPORTS) {
          const d = haversineM(lat, lng, a.lat, a.lng);
          if (d < nearestDist) { nearest = a; nearestDist = d; }
        }
        station = nearest.name;
        distanceM = nearestDist;
      }
    }

    // 거리 기반 도보/차로 판정 (경계 2km) — 20km 기차역에 도보 계수를 먹여 "도보 250분"이 나오던 버그 차단
    const transitMode: 'walk' | 'car' = distanceM <= WALK_MAX_M ? 'walk' : 'car';
    const transitMinutes = toMinutes(distanceM, transitMode === 'walk' ? WALK : DRIVE);
    // 비현실 컷오프: 폐역·화물역 제외 후에도 남는 원거리(섬·오지)는 포기 — 잘못된 정보보다 null
    if (transitMinutes > MAX_TRANSIT_MIN) return null;
    return { nearestStation: station, transitMinutes, transitMode };
  } catch (e) {
    // 실패 허용: API 오류·타임아웃은 로그만 — 저장 흐름 무방해
    console.error('[autoTransit] 기준점 검색 실패', e);
    return null;
  }
}
