'use client';

import { ExternalLink } from 'lucide-react';
import { CATEGORY_COLOR, formatAmount, type CostCategory } from '../_lib/cost';
import { CATEGORY_ICON } from './CostSection';
import { formatApproxCost } from '@/lib/plan/format-approx-cost';
import { openNaverDirections } from '@/lib/naver/directionsUrl';

// 0494: address·movie는 파인더 상세 전용(Spot 조인값). 소유자 뷰는 미전달 → undefined → 렌더 안 함.
// 0501: lat/lng도 파인더 상세 전용 — 있으면 주소를 길찾기 링크로. 소유자 뷰·미연결 항목은 undefined/null.
type SpotInfo = { id: string; day: number; name: string; order?: number; lat?: number | null; lng?: number | null; address?: string | null; movie?: string | null };
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
            // 0502: 출발지 = 같은 날 order상 직전 항목(items는 order asc). 그날 첫 항목이거나
            //       직전 항목에 좌표가 없으면 undefined → 현행처럼 목적지만.
            const prev = i > 0 ? items[i - 1].spot : null;
            const origin =
              prev && prev.lat != null && prev.lng != null
                ? { name: prev.name, lat: prev.lat, lng: prev.lng }
                : undefined;
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
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-[13px] font-semibold text-[#1A1A1A] truncate">{spot.name}</p>
                        {/* 0494: 대표 작품 칩(파인더 상세, spotMovies[0]) */}
                        {spot.movie && (
                          <span className="shrink-0 text-[10px] leading-none px-1.5 py-[3px] rounded-full bg-[#F0F0F0] text-[#666]">
                            {spot.movie}
                          </span>
                        )}
                      </div>
                      {/* 0494: 주소 한 줄(파인더 상세, Spot.address).
                          0501: 좌표 있으면 길찾기 링크(openNaverDirections, 목적지만) + 외부링크 아이콘.
                          없으면 평범한 텍스트. 모바일 터치 영역 min-h-[44px](CLAUDE.md §5), 데스크톱은 compact. */}
                      {spot.address &&
                        (spot.lat != null && spot.lng != null ? (
                          <button
                            type="button"
                            onClick={() =>
                              openNaverDirections(
                                { name: spot.name, lat: spot.lat!, lng: spot.lng! },
                                origin,
                              )
                            }
                            aria-label={`${spot.name} 네이버 지도 길찾기`}
                            className="mt-0.5 flex max-w-full items-center gap-1 min-h-[44px] sm:min-h-0 text-left text-[12px] text-[#8A8A8A] hover:text-[#4A4A4A] transition-colors"
                          >
                            <span className="truncate">{spot.address}</span>
                            <ExternalLink size={12} aria-hidden className="shrink-0" />
                          </button>
                        ) : (
                          <p className="mt-0.5 text-[12px] text-[#8A8A8A] truncate">{spot.address}</p>
                        ))}
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
