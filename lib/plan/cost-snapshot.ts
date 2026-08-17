// 0594: 담은 플랜의 비용 주의 배너 판정 — "담은 뒤 금액이 실제로 바뀌었는가".
//
// 배너의 목적은 출처 표시가 아니라 **담은 사람에게 확인을 요청하는 안내**다(0593).
// 그래서 사라져야 하는 시점은 공개한 때(0593의 기준 — 폐기)도, 저장을 한 번 한 때도 아니고
// **금액을 실제로 고쳤을 때**다. "저장 한 번이면 끄기"는 확인만 하고 안 고쳐도 꺼져서
// 배너가 아무 일도 안 한 게 된다.
//
// 판정은 **저장된 사실**로만 한다. 편집 폼에서 라이브 합계와 비교하면 두 가지가 깨진다:
//   ① 고쳤다가 되돌리면 배너가 깜빡인다
//   ② 고치고 저장 없이 나갔다 다시 들어오면 사라졌던 배너가 떠 있다 — 화면이 방금 한 말을 뒤집는다
// 둘 다 "저장 한 번이면 끄기"와 같은 계열의 실패다. 그래서 이 술어는 **서버 컴포넌트에서만**
// 호출하고(읽기 상세 page / 편집 page), 화면에는 결과 불리언만 내려보낸다 —
// 폼이 실수로 라이브 값과 비교할 수 없게 구조로 막는다.
//
// 총액 비교이지 항목별 비교가 아니다. 상쇄 수정(하나 +1만, 하나 -1만)은 못 잡지만,
// 실패 방향이 안전하다 — 못 잡으면 배너가 **남는다**(확인하라는 안내가 한 번 더). 반대 실패
// (안 고쳤는데 사라짐)보다 무해하다. 항목별 비교는 저장이 deleteMany+전량 재생성이라 행 id
// 대응이 없고, (day, order) 튜플 해시로 하면 0588 드래그로 순서만 바꿔도 배너가 사라진다.

/**
 * 담은 뒤 비용 총액이 그대로인가.
 *
 * @param sourceCostTotal 담은 시점 스냅샷(MyPlan.sourceCostTotal). **null = 스냅샷 없음**
 *   (담기가 아닌 플랜 / 0594 이전에 담긴 플랜) → 판정 불가이므로 배너를 띄우지 않는다.
 *   0("합계 0원")과 구분되는 값이라 `!= null`로 본다.
 * @param currentCostTotal 현재 **저장된** PlanCost 합. PlanFlight는 넣지 않는다 —
 *   담기가 항공을 복사하지 않으므로(0580) 스냅샷 쪽이 늘 0이고, 나중에 항공권을 붙이면
 *   "비용을 안 고쳤는데" 총액이 달라진다.
 */
export function isCostUnchangedFromSource(
  sourceCostTotal: number | null | undefined,
  currentCostTotal: number,
): boolean {
  return sourceCostTotal != null && sourceCostTotal === currentCostTotal;
}

// ─────────────────────────────────────────────────────────────────────────────
// 0595: 총액 대조 → **행 대조 + 이벤트 기록**(MyPlan.costEdited).
//   총액은 최종 상태만 봐서 상쇄 수정(한 항목 +1만, 다른 항목 -1만)을 못 잡았다.
//   위 isCostUnchangedFromSource는 판정에서 빠졌지만 sourceCostTotal 컬럼과 함께 남긴다
//   (담은 시점 금액 표시에 쓸 여지 — 사용자 확정).

/** 비교 키. **order·planSpotId는 없다** — 순서 변경(0588 드래그)과 장소 재연결은 금액 수정이 아니다. */
export type CostRowKey = {
  day: number | null;
  category: string;
  label: string;
  amount: number;
};

/** 저장될 비용 행 = 비교 키 + 쓰기에만 필요한 값(order·localId). */
export type CostRowToWrite = CostRowKey & { order: number; localId: string | null };

/**
 * 폼 페이로드 → **실제로 저장될** 비용 행.
 *
 * 이 함수가 존재하는 이유가 0595의 핵심이다. 판정을 페이로드끼리 비교하면
 * **아무것도 안 고쳐도 "고쳤다"가 된다** — 저장 경로가 페이로드를 그대로 쓰지 않기 때문이다:
 *   ① `amount <= 0`인 행은 저장되지 않는다
 *   ② 장소에 연결된 비용의 label은 **장소 이름으로 강제**된다(이름이 정본 — 0562 D②).
 *      폼은 연결 비용의 label을 빈 문자열로 들고 있다(edit/page 복원 규칙).
 * 그래서 buildPlanRows가 이 함수의 결과를 **그대로 써서** PlanCost를 만들고, 판정도 같은
 * 결과를 비교한다 — 쓰는 것과 비교하는 것이 같은 계산이라 둘이 어긋날 수 없다.
 *
 * order는 그룹(day)별 러닝 카운터다(0588) — 배열 인덱스가 아니다.
 */
export function costRowsToWrite(input: {
  dayCosts: { localId: string | null; day: number; category: string; label: string; amount: number }[];
  daylessCosts: { category: string; label: string; amount: number }[];
  /** localId → 장소 이름. 연결 비용의 label 강제에 쓴다(저장 시 생성되는 PlanSpot.name과 같은 값). */
  nameByLocalId: Map<string, string>;
}): CostRowToWrite[] {
  const rows: CostRowToWrite[] = [];
  const orderByDay = new Map<number, number>();
  for (const cost of input.dayCosts) {
    if (cost.amount <= 0) continue;
    const linkedName = cost.localId ? input.nameByLocalId.get(cost.localId) : undefined;
    const order = orderByDay.get(cost.day) ?? 0;
    orderByDay.set(cost.day, order + 1);
    rows.push({
      day: cost.day,
      order,
      // 연결이 풀린 localId는 기타 지출로 강등(planSpotId NULL·라벨 유지) — 저장 경로와 동일.
      localId: linkedName !== undefined ? cost.localId : null,
      category: cost.category,
      label: linkedName ?? cost.label,
      amount: cost.amount,
    });
  }
  let daylessOrder = 0;
  for (const cost of input.daylessCosts) {
    if (cost.amount <= 0) continue;
    rows.push({
      day: null,
      order: daylessOrder,
      localId: null,
      category: cost.category,
      label: cost.label,
      amount: cost.amount,
    });
    daylessOrder += 1;
  }
  return rows;
}

/** 비교용 정규화 — 다중집합 비교라 정렬한다(행 순서 자체는 의미 없음). */
function costRowKeys(rows: CostRowKey[]): string[] {
  return rows.map((r) => `${r.day ?? 'n'}|${r.category}|${r.label}|${r.amount}`).sort();
}

/**
 * 저장 전 행과 저장될 행이 다른가 — 다르면 "금액을 고쳤다"로 본다.
 * 다중집합 비교라 **행 순서는 무시**한다(order 미포함과 같은 이유).
 */
export function hasCostRowsChanged(prev: CostRowKey[], next: CostRowKey[]): boolean {
  const a = costRowKeys(prev);
  const b = costRowKeys(next);
  if (a.length !== b.length) return true;
  return a.some((v, i) => v !== b[i]);
}
