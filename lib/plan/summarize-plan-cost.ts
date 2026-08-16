import 'server-only';
import {
  CATEGORIES,
  CATEGORY_LABEL,
  type CostCategory,
} from '@/app/(protected)/my-plan/_lib/cost';
import { calcPlanTotal, flightTotal } from './calc-plan-total';

export type PublicCostSummary = {
  ratios: Array<{
    category: CostCategory | 'FLIGHT';
    label: string;
    ratio: number;
    amount: number; // 0492: 금액 공개 — 항목별 실금액(내림차순 정렬 유지)
  }>;
  // 0499: 항목 단위 상세를 일자별 그룹으로 묶음. 항공(dayless)은 day=null 그룹으로 맨 위.
  // 0504: 무장소 비용(day=null)은 '여행 전체' 그룹으로 항공 다음·Day 앞.
  // 0563: day≠null 그룹은 dayGroups로 이관 — itemGroups는 **day=null 전용**(항공·여행 전체).
  //   소비처(PublicCostSection)의 filter(day===null)는 무변 동작.
  itemGroups: Array<{
    day: number | null; // 0563부터 항상 null — 필드는 소비처 필터 호환용 유지
    label: string; // '항공' | '여행 전체'
    items: Array<{
      label: string;
      category: CostCategory | 'FLIGHT';
      amount: number;
    }>;
  }>;
  // 0563: 일자별 비용 — 장소 단위 재구조화. 구 "PlanCost 행 그대로(롤업 X, 0499)"는 금액순
  //   평면 나열이라 같은 장소 지출이 흩어졌다("이 코스에 얼마가 어디에"에 답을 못 함).
  //   그룹 키 = planSpotId ?? 'misc:'+label — 같은 라벨 기타 지출은 한 묶음.
  //   같은 장소가 여러 날이면 day 버킷이 바깥이라 날짜별 각각 묶인다(확정 동작).
  //   정렬: 날짜 오름차순 / 장소 합계 내림차순(0498 금액 내림차순 계보를 장소 축으로 승계) /
  //   장소 안 카테고리 금액 내림차순.
  dayGroups: Array<{
    day: number;
    total: number; // 그날 소계
    places: Array<{
      label: string; // 장소 이름(연결 — 저장 시 서버가 장소 이름으로 강제) 또는 기타 지출 label
      total: number; // 장소 합계
      items: Array<{ category: CostCategory; amount: number }>;
    }>;
  }>;
  total: number; // 0492: 금액 공개 — 계획 총액(항공 포함)
  // 0558: band(구간) 폐기 — 비공개는 0557 접근 제어가 글 자체를 가리므로 구간 가공 불필요.
  currency: 'KRW' | 'USD' | 'JPY';
};

export function summarizePlanCost(
  // 0498: label·day는 항목 리스트용(옵셔널) — 요약 한 줄만 쓰는 소비처(story 3곳)는 select 안 해도 됨.
  // 0504: day는 nullable — null = 무장소 비용('여행 전체' 그룹). day 미select 소비처는 undefined(itemGroups 미렌더).
  // 0563: planSpotId는 장소 묶음용(옵셔널) — 미select 소비처는 misc 취급이나 dayGroups 미렌더라 무해.
  costs: { category: string; amount: number; label?: string; day?: number | null; planSpotId?: string | null }[],
  flight: { totalAmount: number } | null | undefined,
  currency: 'KRW' | 'USD' | 'JPY',
  // 0587: 항공 1인 요금 × 인원. 기본값 1은 기존 테스트 호출 호환용 —
  //   실제 호출부는 전부 명시적으로 넘긴다(calc-plan-total.ts 주석에 목록).
  headcount = 1,
): PublicCostSummary {
  // 0587: 항공 금액이 나오는 지점은 셋(total · itemGroups 항공 · ratios FLIGHT)이고
  //   **전부 이 파생값을 쓴다** — 한 곳만 곱하면 비중 합이 100%에서 어긋난다.
  const flightAmount = flightTotal(flight, headcount);
  const total = calcPlanTotal(costs, flight, headcount);

  // 0499: 일자별 그룹핑. 존재하는 PlanCost 행에서만 파생 → 비용 없는 날은 그룹 자체가 안 생김(머리글 생략).
  // 0504: day=null(무장소 비용)은 별도 '여행 전체' 버킷으로.
  // 0563: day≠null은 날짜 → 장소 2단 버킷 — 그룹 키 planSpotId ?? 'misc:'+label.
  const daylessItems: PublicCostSummary['itemGroups'][number]['items'] = [];
  const dayBuckets = new Map<number, Map<string, { label: string; items: { category: CostCategory; amount: number }[] }>>();
  for (const c of costs) {
    if (c.amount <= 0) continue;
    if (c.day == null) {
      daylessItems.push({ label: c.label ?? '', category: c.category as CostCategory, amount: c.amount });
      continue;
    }
    if (!dayBuckets.has(c.day)) dayBuckets.set(c.day, new Map());
    const places = dayBuckets.get(c.day)!;
    const key = c.planSpotId ?? `misc:${c.label ?? ''}`;
    if (!places.has(key)) places.set(key, { label: c.label ?? '', items: [] });
    places.get(key)!.items.push({ category: c.category as CostCategory, amount: c.amount });
  }

  const itemGroups: PublicCostSummary['itemGroups'] = [
    // 항공(dayless) 머리글 그룹을 맨 위에 — Day 머리글과 평행 구조(0499 Q1)
    ...(flightAmount > 0
      ? [
          {
            day: null,
            label: '항공',
            items: [{ label: '항공', category: 'FLIGHT' as const, amount: flightAmount }],
          },
        ]
      : []),
    // 0504: 무장소 비용 — 항공 다음·Day 앞(여행 단위 비용을 per-day 위에 형제로). 금액 내림차순.
    ...(daylessItems.length > 0
      ? [
          {
            day: null,
            label: '여행 전체',
            items: daylessItems.sort((a, b) => b.amount - a.amount),
          },
        ]
      : []),
  ];

  // 0563: 날짜 오름차순 / 장소 합계 내림차순 / 장소 안 카테고리 금액 내림차순(0498 계보)
  const dayGroups: PublicCostSummary['dayGroups'] = [...dayBuckets.keys()]
    .sort((a, b) => a - b)
    .map((day) => {
      const places = [...dayBuckets.get(day)!.values()]
        .map((p) => ({
          label: p.label,
          total: p.items.reduce((s, it) => s + it.amount, 0),
          items: p.items.sort((a, b) => b.amount - a.amount),
        }))
        .sort((a, b) => b.total - a.total);
      return { day, total: places.reduce((s, p) => s + p.total, 0), places };
    });

  if (total === 0) {
    return { ratios: [], itemGroups: [], dayGroups: [], total, currency };
  }

  const items = [
    { category: 'FLIGHT' as const, label: '항공', amount: flightAmount },
    ...CATEGORIES.map((cat) => ({
      category: cat,
      label: CATEGORY_LABEL[cat],
      amount: costs
        .filter((c) => c.category === cat)
        .reduce((s, c) => s + c.amount, 0),
    })),
  ].filter((item) => item.amount > 0);

  const rawRatios = items.map((item) => (item.amount / total) * 100);
  const floored = rawRatios.map(Math.floor);
  const deficit = 100 - floored.reduce((s, v) => s + v, 0);

  if (deficit > 0) {
    const remainders = rawRatios.map((r, i) => r - floored[i]);
    const indices = remainders
      .map((rem, i) => ({ i, rem }))
      .sort((a, b) => b.rem - a.rem)
      .slice(0, deficit)
      .map(({ i }) => i);
    for (const idx of indices) floored[idx] += 1;
  }

  const ratios = items
    .map((item, i) => ({
      category: item.category,
      label: item.label,
      ratio: floored[i],
      amount: item.amount,
    }))
    .sort((a, b) => b.ratio - a.ratio);

  return { ratios, itemGroups, dayGroups, total, currency };
}
