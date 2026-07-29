// 0405: 지역 문자열 → region-covers.json(0404) 풀에서 커버 URL 1개 무작위 선택.
// 런타임 TourAPI 호출 없음(사전 시드 JSON만 읽음). 매칭 실패 시 null(호출부에서 커버 미부여).

import coversData from '../../prisma/region-covers.json';

const pools: Record<string, string[]> = coversData.regions;

// 지역명 첫 토큰 → 풀 키 별칭. 지역 추가 시 여기만 손본다. 값 집합 = seed-region-covers.ts REGIONS(17 시·도).
// (예: region 입력이 "서울특별시 중구…"·"강원도 강릉…"처럼 다양해도 풀 키로 수렴. 축약·정식·신명칭 모두 매핑.)
// 시(市) 단위(예: "경주")는 17 시·도가 아니므로 미매핑 → null(지역 커버 없음, 작품 후보로만 폴백).
const REGION_ALIAS: Record<string, string> = {
  서울: '서울', 서울특별시: '서울',
  부산: '부산', 부산광역시: '부산',
  대구: '대구', 대구광역시: '대구',
  인천: '인천', 인천광역시: '인천',
  광주: '광주', 광주광역시: '광주',
  대전: '대전', 대전광역시: '대전',
  울산: '울산', 울산광역시: '울산',
  세종: '세종', 세종특별자치시: '세종', 세종시: '세종',
  경기: '경기', 경기도: '경기',
  강원: '강원', 강원도: '강원', 강원특별자치도: '강원',
  충북: '충북', 충청북도: '충북',
  충남: '충남', 충청남도: '충남',
  전북: '전북', 전라북도: '전북', 전북특별자치도: '전북',
  전남: '전남', 전라남도: '전남',
  경북: '경북', 경상북도: '경북',
  경남: '경남', 경상남도: '경남',
  제주도: '제주도', 제주: '제주도', 제주특별자치도: '제주도', 제주시: '제주도',
};

// region 문자열의 첫 토큰을 별칭 맵으로 정규화해 풀 키를 찾는다. 실패 시 null.
export function normalizeRegionKey(region: string | null | undefined): string | null {
  if (!region) return null;
  const firstToken = region.trim().split(/\s+/)[0];
  const key = REGION_ALIAS[firstToken];
  if (key && pools[key]?.length) return key;
  return null;
}

// 매칭된 지역 풀에서 무작위 URL 1개. 매칭 실패·빈 풀이면 null.
export function pickRegionCover(region: string | null | undefined): string | null {
  const key = normalizeRegionKey(region);
  if (!key) return null;
  const pool = pools[key];
  return pool[Math.floor(Math.random() * pool.length)];
}

// 매칭된 지역 풀 전체(0410 pick-cover가 후보 수집에 재사용). 매칭 실패 시 빈 배열.
export function regionCoverPool(region: string | null | undefined): string[] {
  const key = normalizeRegionKey(region);
  return key ? pools[key] : [];
}
