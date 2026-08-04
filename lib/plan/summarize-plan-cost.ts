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
  // 0498: 항목 단위 상세 — PlanCost 행 그대로(카테고리 롤업 X). 항공은 합성 항목.
  items: Array<{
    label: string;
    category: CostCategory | 'FLIGHT';
    amount: number;
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
  // 0498: label은 항목 리스트용(옵셔널) — band만 쓰는 소비처(story 3곳)는 select 안 해도 됨.
  costs: { category: string; amount: number; label?: string }[],
  flight: { totalAmount: number } | null | undefined,
  currency: 'KRW' | 'USD' | 'JPY',
): PublicCostSummary {
  const total = calcPlanTotal(costs, flight);
  const band = computeBand(total, currency);

  // 0498: 항목 단위 — 항공(합성) + PlanCost 행 그대로. 금액 내림차순.
  const lineItems = [
    ...(flight && flight.totalAmount > 0
      ? [{ label: '항공', category: 'FLIGHT' as const, amount: flight.totalAmount }]
      : []),
    ...costs
      .filter((c) => c.amount > 0)
      .map((c) => ({
        label: c.label ?? '',
        category: c.category as CostCategory,
        amount: c.amount,
      })),
  ].sort((a, b) => b.amount - a.amount);

  if (total === 0) {
    return { ratios: [], items: [], total, band, currency };
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

  return { ratios, items: lineItems, total, band, currency };
}
