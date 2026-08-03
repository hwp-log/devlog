import { CATEGORY_COLOR, formatAmount, type CostCategory } from '../_lib/cost';
import { CATEGORY_ICON } from './CostSection';
import { formatApproxCost } from '@/lib/plan/format-approx-cost';

type SpotInfo = { id: string; day: number; name: string; order?: number };
type CostInfo = { planSpotId: string | null; category: string; amount: number };

export type TimelineItem = {
  spot: SpotInfo;
  cost: CostInfo | null;
};

export function buildTimeline(
  spots: SpotInfo[],
  costs: CostInfo[],
  day: number,
): TimelineItem[] {
  const daySpots = spots.filter((s) => s.day === day);
  const costMap = new Map(
    costs
      .filter((c) => c.planSpotId != null)
      .map((c) => [c.planSpotId!, c])
  );
  return daySpots.map((spot) => ({
    spot,
    cost: costMap.get(spot.id) ?? null,
  }));
}

const PIN_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>
);

interface Props {
  items: TimelineItem[];
  currency: 'KRW' | 'USD' | 'JPY';
  showAmount?: boolean;
  // 0492: 공개 상세 변형 — 기본값은 소유자 뷰(우측 인라인·정확금액) 그대로라 무영향.
  amountPlacement?: 'inline' | 'bottom';
  amountFormat?: 'exact' | 'approx';
}

export function PlanTimeline({
  items,
  currency,
  showAmount = true,
  amountPlacement = 'inline',
  amountFormat = 'exact',
}: Props) {
  return (
    <div className="glass-outer p-5 mb-4">
      {items.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-6">항목이 없습니다.</p>
      ) : (
        <div className="flex flex-col">
          {items.map(({ spot, cost }, i) => {
            const isFirst = i === 0;
            const isLast = i === items.length - 1;
            const markerBg = 'bg-blue-500';
            // 미입력(연결 비용 없음)은 금액 줄 자체를 렌더하지 않는다. 실제 0원만 "무료"(양쪽 화면 공통 규칙).
            const showAmountLine = showAmount && cost != null;
            const amountText =
              cost && cost.amount > 0
                ? amountFormat === 'approx'
                  ? formatApproxCost(cost.amount, currency)
                  : formatAmount(cost.amount, currency)
                : '무료';
            return (
              <div key={spot.id} className="flex gap-3">
                <div className="flex flex-col items-center w-[18px] shrink-0">
                  <div className={`w-px flex-1${isFirst ? ' bg-transparent' : ' bg-[#E0E0E0]'}`} />
                  <div className={`w-[18px] h-[18px] rounded-full ${markerBg} text-white text-[10px] font-bold flex items-center justify-center shrink-0`}>
                    {i + 1}
                  </div>
                  <div className={`w-px flex-1${isLast ? ' bg-transparent' : ' bg-[#E0E0E0]'}`} />
                </div>
                <div className={`flex-1${isLast ? '' : ' pb-3'}`}>
                  <div className="bg-white border-[0.5px] border-black/[0.08] rounded-[10px] px-[14px] py-[10px] flex items-center gap-[10px]">
                    <div
                      className="w-7 h-7 rounded-[8px] bg-[#F5F5F5] flex items-center justify-center shrink-0"
                      style={{ color: cost ? CATEGORY_COLOR[cost.category as CostCategory] : '#9CA3AF' }}
                    >
                      {cost ? CATEGORY_ICON[cost.category as CostCategory] : PIN_ICON}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#1A1A1A] truncate">{spot.name}</p>
                      {showAmountLine && amountPlacement === 'bottom' && (
                        <p className="mt-0.5 text-[12px] font-semibold text-[#4A4A4A]">{amountText}</p>
                      )}
                    </div>
                    {showAmountLine && amountPlacement === 'inline' && (
                      <p className="text-[12px] font-semibold text-[#4A4A4A] shrink-0">{amountText}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
