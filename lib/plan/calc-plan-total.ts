// 0587: PlanFlight.totalAmount는 **1인 요금**이다 — 이름의 "total"은 왕복(가는편+오는편)
//   총액이지 전원 총액이 아니다. 근거 3단: 검색이 adults='1'로 조회(lib/flights/client.ts) →
//   파서가 price.raw를 그대로 담음(lib/flights/parser.ts) → 저장(flightFields)이 무가공.
//   따라서 인원 반영은 **표시·합계 시점의 곱셈**이고 DB 값은 건드리지 않는다.

/**
 * 항공 총액 = 1인 요금 × 인원. **곱셈은 이 함수 한 곳**이고 나머지는 전부 여기를 거친다.
 * headcount는 스키마 기본값이 1이고 저장 시 1~20으로 클램프되지만(validate-input),
 * 방어적으로 하한 1 — 0이 들어오면 항공비가 통째로 사라져 조용한 과소 집계가 된다.
 */
export function flightTotal(
  flight: { totalAmount: number } | null | undefined,
  headcount: number,
): number {
  return (flight?.totalAmount ?? 0) * Math.max(1, headcount);
}

// headcount 기본값 1 — 필수 인자로 바꾸면 기존 테스트 호출이 전부 깨진다(테스트 수정 금지 규칙).
// 대신 실제 호출부 7곳은 0587에서 전부 명시적으로 넘긴다: MyPlanNewForm / plan-finder[id]/page /
// queries.ts / my-plan/page / mypage/page / story[id]/page / story(new·edit)/page.
// **새 호출부를 만들면 headcount를 반드시 넘길 것** — 빠뜨리면 1인으로 조용히 계산된다.
export function calcPlanTotal(
  costs: { amount: number }[],
  flight?: { totalAmount: number } | null,
  headcount = 1,
): number {
  return costs.reduce((s, c) => s + c.amount, 0) + flightTotal(flight, headcount);
}
