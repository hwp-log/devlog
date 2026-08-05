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
  // 0508: 주소 슬롯 확보 여부 — 호출자가 플랜 전체(spots) 기준으로 전달하면 Day 탭 전환에도
  //   카드 높이가 유지된다. 미전달 시 그날 items에서 파생(소유자 뷰는 주소가 없어 슬롯 없음).
  reserveAddressSlot?: boolean;
}

export function PlanTimeline({
  items,
  currency,
  showAmount = true,
  amountPlacement = 'inline',
  amountFormat = 'exact',
  reserveAddressSlot,
}: Props) {
  // 0508: 카드 높이 통일 — 주소가 하나라도 있으면 모든 카드에 주소 줄 자리를 고정 확보
  //   (없는 카드는 빈 줄). 주소 데이터가 아예 없는 뷰(소유자 my-plan)는 슬롯 자체가 안 생겨
  //   기존 그대로. 판정 범위는 호출자 prop 우선(플랜 전체 기준 — Day 탭 전환 시 높이 유지).
  const hasAnyAddress = reserveAddressSlot ?? items.some((it) => it.spot.address);
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
                          없으면 평범한 텍스트.
                          0508: 슬롯 높이 18px 고정(주소 없으면 빈 줄) — 카드 높이·이름 시작 위치 통일.
                          모바일 터치 44px(CLAUDE.md §5)은 min-h-[44px] + -my-[13px]로 레이아웃 안 밀고
                          확보(44-26=18px 점유) — 이전처럼 레이아웃을 밀면 링크 카드만 커져 높이가 갈라짐. */}
                      {hasAnyAddress && (
                        <div className="mt-0.5 h-[18px] text-[12px] leading-[18px]">
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
                                className="flex max-w-full items-center gap-1 min-h-[44px] -my-[13px] sm:min-h-0 sm:my-0 text-left text-[#8A8A8A] hover:text-[#4A4A4A] transition-colors"
                              >
                                <span className="truncate">{spot.address}</span>
                                <ExternalLink size={12} aria-hidden className="shrink-0" />
                              </button>
                            ) : (
                              <p className="text-[#8A8A8A] truncate">{spot.address}</p>
                            ))}
                        </div>
                      )}
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
