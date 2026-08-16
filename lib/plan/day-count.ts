// 0582: 플랜 일수 산출 단일 소스 — 상세(plan-finder/[id])·편집(my-plan/[id]/edit) 공용.
//
// 3단 폴백:
//   ① 날짜 둘 다 있으면 역산 (구 방식 그대로)
//   ② 없으면 PlanSpot의 최대 day — 날짜 없는 플랜에도 Day 구조가 있기 때문이다.
//      구 방식은 여기서 1로 떨어져 day≥2 항목이 **행은 있는데 화면에 없는** 상태가 됐고,
//      그 상태로 편집 저장하면 실제로 삭제됐다(0579 조사에서 드러난 경로).
//   ③ 둘 다 없으면 1 (빈 플랜)
//
// 같은 일수 식을 쓰는 곳이 둘 더 있다 — lib/plan/queries.ts(목록 카드)와
// lib/plan/summary-line.ts(스토리 요약 한 줄). 둘은 **폴백이 다르다**: 날짜가 없으면
// null·생략으로 "일수 표시 없음"이 되고, 이 함수처럼 day로 대체하지 않는다.
// 목록 카드가 상세와 다른 일수를 말하는 게 맞는지는 미판정(0582 범위 밖) — 합칠 때
// 폴백까지 같이 볼 것. 지금 식만 공유하면 폴백이 조용히 갈린다.
export function resolvePlanDayCount(
  startDate: Date | null,
  endDate: Date | null,
  spots: { day: number }[],
): number {
  if (startDate && endDate) {
    const diff = endDate.getTime() - startDate.getTime();
    return Math.max(1, Math.ceil(diff / 86_400_000) + 1);
  }
  if (spots.length > 0) return Math.max(1, ...spots.map((s) => s.day));
  return 1;
}
