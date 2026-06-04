export type CostCategory = 'TRANSPORT' | 'ACCOMMODATION' | 'FOOD' | 'ENTRANCE' | 'ETC';

export const CATEGORIES: CostCategory[] = [
  'TRANSPORT',
  'ACCOMMODATION',
  'FOOD',
  'ENTRANCE',
  'ETC',
];

export const CATEGORY_LABEL: Record<CostCategory, string> = {
  TRANSPORT: '교통',
  ACCOMMODATION: '숙박',
  FOOD: '식비',
  ENTRANCE: '입장료',
  ETC: '기타',
};

export const CATEGORY_COLOR: Record<CostCategory, string> = {
  TRANSPORT:     '#3B82F6',
  ACCOMMODATION: '#F97316',
  FOOD:          '#EF4444',
  ENTRANCE:      '#22C55E',
  ETC:           '#94A3B8',
};

const CURRENCY_SYMBOL: Record<'KRW' | 'USD' | 'JPY', string> = {
  KRW: '₩',
  USD: '$',
  JPY: '¥',
};

export const FLIGHT_COLOR = '#38BDF8';

export function formatAmount(
  amount: number,
  currency: 'KRW' | 'USD' | 'JPY',
): string {
  return `${CURRENCY_SYMBOL[currency]}${amount.toLocaleString()}`;
}
