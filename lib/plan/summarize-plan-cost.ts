import 'server-only';
import {
  CATEGORIES,
  CATEGORY_LABEL,
  type CostCategory,
} from '@/app/(protected)/my-plan/_lib/cost';
import { calcPlanTotal } from './calc-plan-total';

export type PublicCostSummary = {
  ratios: Array<{
    category: CostCategory | 'FLIGHT';
    label: string;
    ratio: number;
    amount: number; // 0492: 금액 공개 — 항목별 실금액(내림차순 정렬 유지)
  }>;
  // 0499: 항목 단위 상세를 일자별 그룹으로 묶음. 항공(dayless)은 day=null 그룹으로 맨 위.
  // 0504: 무장소 비용(day=null)은 '여행 전체' 그룹으로 항공 다음·Day 앞.
  // 비용 있는 날만 오름차순, 날짜 안은 금액 내림차순(0498 정렬 유지). PlanCost 행 그대로(롤업 X).
  itemGroups: Array<{
    day: number | null; // null = 항공(합성) 또는 여행 전체(무장소 비용) → 목록 위쪽
    label: string; // '항공' | '여행 전체' | `Day ${day}`
    items: Array<{
      label: string;
      category: CostCategory | 'FLIGHT';
      amount: number;
    }>;
  }>;
  total: number; // 0492: 금액 공개 — 계획 총액(항공 포함)
  band: { lower: number; upper: number } | null;
  currency: 'KRW' | 'USD' | 'JPY';
};

function computeBand(
  total: number,
  currency: 'KRW' | 'USD' | 'JPY',
): { lower: number; upper: number } | null {
  if (currency !== 'KRW') return null;
  let width: number;
  if (total < 500_000) {
    width = 100_000;
  } else if (total < 1_000_000) {
    width = 250_000;
  } else {
    width = 500_000;
  }
  const lower = Math.floor(total / width) * width;
  return { lower, upper: lower + width };
}

export function summarizePlanCost(
  // 0498: label·day는 항목 리스트용(옵셔널) — band만 쓰는 소비처(story 3곳)는 select 안 해도 됨.
  // 0504: day는 nullable — null = 무장소 비용('여행 전체' 그룹). day 미select 소비처는 undefined(itemGroups 미렌더).
  costs: { category: string; amount: number; label?: string; day?: number | null }[],
  flight: { totalAmount: number } | null | undefined,
  currency: 'KRW' | 'USD' | 'JPY',
): PublicCostSummary {
  const total = calcPlanTotal(costs, flight);
  const band = computeBand(total, currency);

  // 0499: 일자별 그룹핑. 존재하는 PlanCost 행에서만 파생 → 비용 없는 날은 그룹 자체가 안 생김(머리글 생략).
  // 0504: day=null(무장소 비용)은 별도 '여행 전체' 버킷으로. day 미select 소비처는 전부 여기로 모이나 itemGroups 미렌더라 무해.
  const dayBuckets = new Map<number, PublicCostSummary['itemGroups'][number]['items']>();
  const daylessItems: PublicCostSummary['itemGroups'][number]['items'] = [];
  for (const c of costs) {
    if (c.amount <= 0) continue;
    const item = {
      label: c.label ?? '',
      category: c.category as CostCategory,
      amount: c.amount,
    };
    if (c.day == null) {
      daylessItems.push(item);
      continue;
    }
    if (!dayBuckets.has(c.day)) dayBuckets.set(c.day, []);
    dayBuckets.get(c.day)!.push(item);
  }

  const itemGroups: PublicCostSummary['itemGroups'] = [
    // 항공(dayless) 머리글 그룹을 맨 위에 — Day 머리글과 평행 구조(0499 Q1)
    ...(flight && flight.totalAmount > 0
      ? [
          {
            day: null,
            label: '항공',
            items: [{ label: '항공', category: 'FLIGHT' as const, amount: flight.totalAmount }],
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
    // 비용 있는 날만 오름차순, 날짜 안은 금액 내림차순(0498 정렬 유지 = within-day A안)
    ...[...dayBuckets.keys()]
      .sort((a, b) => a - b)
      .map((day) => ({
        day,
        label: `Day ${day}`,
        items: dayBuckets.get(day)!.sort((a, b) => b.amount - a.amount),
      })),
  ];

  if (total === 0) {
    return { ratios: [], itemGroups: [], total, band, currency };
  }

  const items = [
    { category: 'FLIGHT' as const, label: '항공', amount: flight?.totalAmount ?? 0 },
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

  return { ratios, itemGroups, total, band, currency };
}
