import {
  CATEGORIES,
  CATEGORY_LABEL,
  formatAmount,
  type CostCategory,
} from '../_lib/cost';

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
