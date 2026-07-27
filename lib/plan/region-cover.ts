// 0405: 지역 문자열 → region-covers.json(0404) 풀에서 커버 URL 1개 무작위 선택.
// 런타임 TourAPI 호출 없음(사전 시드 JSON만 읽음). 매칭 실패 시 null(호출부에서 커버 미부여).

import coversData from '../../prisma/region-covers.json';

const pools: Record<string, string[]> = coversData.regions;

// 지역명 첫 토큰 → 풀 키 별칭. 지역 추가 시 여기만 손본다.
// (예: region 입력이 "서울특별시 중구…"·"제주 서귀포…"처럼 다양해도 풀 키로 수렴)
const REGION_ALIAS: Record<string, string> = {
  서울: '서울',
  서울특별시: '서울',
  제주도: '제주도',
  제주: '제주도',
  제주특별자치도: '제주도',
  제주시: '제주도',
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
