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
  }>;
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
  costs: { category: string; amount: number }[],
  flight: { totalAmount: number } | null | undefined,
  currency: 'KRW' | 'USD' | 'JPY',
): PublicCostSummary {
  const total = calcPlanTotal(costs, flight);
  const band = computeBand(total, currency);

  if (total === 0) {
    return { ratios: [], band, currency };
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
    .map((item, i) => ({ category: item.category, label: item.label, ratio: floored[i] }))
    .sort((a, b) => b.ratio - a.ratio);

  return { ratios, band, currency };
}
