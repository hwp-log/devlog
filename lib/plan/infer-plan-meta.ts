// 0495: region/movie 미입력 시 플랜이 담은 Spot에서 커버 후보용 시·도·작품을 추론.
//   저장값을 덮지 않는다 — pickPlanCover 입력 보강 전용. 사용자 입력이 있으면 호출부에서 그것을 우선한다.
import { PROVINCES, regionKeyFromAddress, regionKeyFromFreeText } from '@/lib/region/provinces';

const PROV_ORDER = new Map(PROVINCES.map((p, i) => [p.key, i]));

// 최빈값 — 동률은 tieBreak로 결정적 선택(입력 순서 비의존).
function mostFrequent<T>(items: T[], tieBreak: (a: T, b: T) => number): T | null {
  const count = new Map<T, number>();
  for (const it of items) count.set(it, (count.get(it) ?? 0) + 1);
  let best: T | null = null;
  let bestN = 0;
  for (const [k, n] of count) {
    if (n > bestN || (n === bestN && best !== null && tieBreak(k, best) < 0)) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

// 주소 목록 → 최빈 시·도 key. 주소 접두 판정(regionKeyFromAddress) 우선, 폴백 첫 토큰(FreeText).
// 동률은 PROVINCES(시·도 표준 순서)로 결정적.
export function inferRegionKey(addresses: (string | null | undefined)[]): string | null {
  const keys = addresses
    .map((a) => (a ? regionKeyFromAddress(a) ?? regionKeyFromFreeText(a) : null))
    .filter((k): k is string => !!k);
  return mostFrequent(keys, (a, b) => (PROV_ORDER.get(a) ?? 99) - (PROV_ORDER.get(b) ?? 99));
}

// 작품 title 목록 → 최빈 title. 동률은 가나다순으로 결정적.
export function inferMovieTitle(titles: (string | null | undefined)[]): string | null {
  const ts = titles.filter((t): t is string => !!t && t.trim() !== '');
  return mostFrequent(ts, (a, b) => a.localeCompare(b));
}
