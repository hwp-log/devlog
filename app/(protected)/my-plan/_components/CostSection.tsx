import type React from 'react';
import {
  CATEGORIES,
  CATEGORY_LABEL,
  formatAmount,
  type CostCategory,
} from '../_lib/cost';

export const FLIGHT_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>
  </svg>
);

export const CATEGORY_ICON: Record<CostCategory, React.ReactNode> = {
  TRANSPORT: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
    </svg>
  ),
  ACCOMMODATION: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z"/>
    </svg>
  ),
  FOOD: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.06 22.99h1.66c.84 0 1.53-.64 1.63-1.46L23 5.05h-5V1h-1.97v4.05h-4.97l.3 2.34c1.71.47 3.31 1.32 4.27 2.26 1.44 1.42 2.43 2.89 2.43 5.29v8.05zM1 21.99V21h15.03v.99c0 .55-.45 1-1.01 1H2.01c-.56 0-1.01-.45-1.01-1zm15.03-7c0-4-15.03-4-15.03 0h15.03zM1.02 17h15v2h-15z"/>
    </svg>
  ),
  ENTRANCE: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 10V6c0-1.11-.9-2-2-2H4c-1.1 0-1.99.89-1.99 2v4c1.1 0 1.99.9 1.99 2s-.89 2-1.99 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2zm-2-1.46c-1.19.69-2 1.99-2 3.46s.81 2.77 2 3.46V18H4v-2.54c1.19-.69 2-1.99 2-3.46 0-1.48-.8-2.77-2-3.46V6h16v2.54z"/>
    </svg>
  ),
  ETC: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 3.02 15.96 1 13.45 1h-2.9C8.04 1 6 3.02 6 4.64c0 .48.11.92.18 1.36H4C2.9 6 2 6.9 2 8v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6.55-3c.83 0 1.55.45 1.55 1.64H9c0-1.19.72-1.64 1.55-1.64h2.9z"/>
    </svg>
  ),
};

interface Props {
  totals: Record<CostCategory, number>;
  flightAmount: number;
  total: number;
  currency: 'KRW' | 'USD' | 'JPY';
}

// 0527: 카테고리 색 = 이름 왼쪽 3px 막대(아이콘·진행 막대 대체). 색은 읽기 화면(0524 cat-* 토큰)과
//   한 벌 — 읽는 쪽과 쓰는 쪽에서 같은 카테고리가 같은 색이어야 대응이 성립한다.
const CATEGORY_BAR: Record<CostCategory | 'FLIGHT', string> = {
  TRANSPORT: 'bg-cat-transport',
  FLIGHT: 'bg-cat-flight',
  FOOD: 'bg-cat-food',
  ACCOMMODATION: 'bg-cat-accommodation',
  ENTRANCE: 'bg-cat-entrance',
  ETC: 'bg-cat-etc',
};

// 0527: 금액 한 줄 — [3px 색 막대][이름][금액]. 0원은 hint로 낮춰 "아직 없음"을 표시.
function CostRow({
  label,
  amount,
  currency,
  bar,
}: {
  label: string;
  amount: number;
  currency: Props['currency'];
  bar: string;
}) {
  return (
    <div className="flex items-center py-2.5">
      <span aria-hidden className={`w-[3px] self-stretch shrink-0 ${bar}`} />
      <span className="pl-2 flex-1 text-base text-fg2">{label}</span>
      <span className={`text-base font-semibold tabular-nums ${amount > 0 ? 'text-cost-amount' : 'text-hint'}`}>
        {formatAmount(amount, currency)}
      </span>
    </div>
  );
}

export function CostSection({ totals, flightAmount, total, currency }: Props) {
  return (
    <>
      {/* 0527: glass-outer 카드 제거 — 개방 캔버스. 진행 막대(비중)는 폐기하고 금액만 남긴다.
          2열(좁으면 1열)로 6~7줄이 한눈에 들어오게. */}
      <div className="mt-[18px] grid grid-cols-1 sm:grid-cols-2 gap-x-14">
        {flightAmount > 0 && (
          <CostRow label="항공" amount={flightAmount} currency={currency} bar={CATEGORY_BAR.FLIGHT} />
        )}
        {CATEGORIES.map((cat) => (
          <CostRow
            key={cat}
            label={CATEGORY_LABEL[cat]}
            amount={totals[cat]}
            currency={currency}
            bar={CATEGORY_BAR[cat]}
          />
        ))}
      </div>
      <div className="mt-3.5 flex items-baseline justify-between pt-[18px] border-t border-border">
        <span className="text-base font-semibold text-fg2">총 비용</span>
        <span className="text-[26px] font-bold tracking-[-0.02em] text-cost-total tabular-nums">
          {formatAmount(total, currency)}
        </span>
      </div>
    </>
  );
}
