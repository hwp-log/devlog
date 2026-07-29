// 0422: Spot.address 시·도 접두 판정 공용 모듈 (seed-region-covers.ts에서 추출).
// 사용처: seed-region-covers.ts(지역 풀 수집), pick-cover.ts(작품 후보 지역 필터).

// 풀 키 → Spot.address 시·도 접두(startsWith 매칭). 신·구 명칭 공존 지역(전북특별자치도/전라북도 등)은 둘 다 나열.
// 경상북/남·전라북/남은 '경상'·'전라'로 뭉뚱그리면 남↔북이 섞이므로 접두를 길게 잡는다.
// 키 집합 = region-cover.ts REGION_ALIAS의 값 집합(17 시·도)과 동일해야 함.
export const SPOT_ADDR_PREFIX: Record<string, string[]> = {
  서울: ['서울'],
  부산: ['부산'],
  대구: ['대구'],
  인천: ['인천'],
  광주: ['광주'],
  대전: ['대전'],
  울산: ['울산'],
  세종: ['세종'],
  경기: ['경기'],
  강원: ['강원'],
  충북: ['충청북'],
  충남: ['충청남'],
  전북: ['전라북', '전북'],
  전남: ['전라남', '전남'],
  경북: ['경상북', '경북'],
  경남: ['경상남', '경남'],
  제주도: ['제주'],
};

// Spot.address가 풀 키의 시·도 접두로 시작하는지 판정.
export function addressMatchesRegionKey(
  address: string | null | undefined,
  regionKey: string,
): boolean {
  const a = address?.trim();
  if (!a) return false;
  return (SPOT_ADDR_PREFIX[regionKey] ?? []).some((p) => a.startsWith(p));
}
