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

const CURRENCY_SYMBOL: Record<'KRW' | 'USD' | 'JPY', string> = {
  KRW: '₩',
  USD: '$',
  JPY: '¥',
};

export function formatAmount(
  amount: number,
  currency: 'KRW' | 'USD' | 'JPY',
): string {
  return `${CURRENCY_SYMBOL[currency]}${amount.toLocaleString()}`;
}
