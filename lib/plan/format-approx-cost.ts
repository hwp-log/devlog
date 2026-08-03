import { formatAmount } from '@/app/(protected)/my-plan/_lib/cost';

/**
 * 0492: 공개 상세의 금액 표기 — KRW는 "약 N만원" 반올림, 그 외 통화는 정확 금액.
 * 목록 카드(0441 priceLabel)와 같은 만원 반올림 규칙을 상세에도 통일한다.
 */
export function formatApproxCost(
  amount: number,
  currency: 'KRW' | 'USD' | 'JPY',
): string {
  if (currency === 'KRW') {
    return `약 ${Math.round(amount / 10_000).toLocaleString()}만원`;
  }
  return formatAmount(amount, currency);
}
