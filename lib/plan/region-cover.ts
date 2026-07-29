// 0405: 지역 문자열 → region-covers.json(0404) 풀에서 커버 URL 1개 무작위 선택.
// 런타임 TourAPI 호출 없음(사전 시드 JSON만 읽음). 매칭 실패 시 null(호출부에서 커버 미부여).

import coversData from '../../prisma/region-covers.json';
import { regionKeyFromFreeText } from '../region/provinces';

const pools: Record<string, string[]> = coversData.regions;

// region 문자열을 시·도 사전(0424 lib/region/provinces.ts)으로 정규화해 풀 키를 찾는다.
// (예: region 입력이 "서울특별시 중구…"·"강원도 강릉…"처럼 다양해도 풀 키로 수렴.)
// 시(市) 단위(예: "경주")는 17 시·도가 아니므로 미매핑 → null(지역 커버 없음, 작품 후보로만 폴백).
export function normalizeRegionKey(region: string | null | undefined): string | null {
  const key = regionKeyFromFreeText(region);
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
