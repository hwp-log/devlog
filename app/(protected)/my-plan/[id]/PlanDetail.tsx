'use client';
import { useState, useTransition } from 'react';
import type React from 'react';
import Link from 'next/link';
import type { MyPlan, PlanSpot, PlanCost, PlanFlight } from '@prisma/client';
import {
  CATEGORIES,
  CATEGORY_LABEL,
  CATEGORY_COLOR,
  formatAmount,
  type CostCategory,
} from '../_lib/cost';

const CATEGORY_ICON: Record<CostCategory, React.ReactNode> = {
  TRANSPORT: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>
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

const AIRPORT_NAME: Record<string, string> = {
  ICN: '인천 국제', GMP: '서울 김포', PUS: '부산 김해', CJU: '제주',
  NRT: '도쿄 나리타', HND: '도쿄 하네다', KIX: '오사카 간사이',
  FUK: '후쿠오카', OKA: '오키나와 나하', NGO: '나고야 중부',
  BKK: '방콕 수완나품', HKT: '푸켓', SIN: '싱가포르 창이',
  HKG: '홍콩', TPE: '타이베이 타오위안', PEK: '베이징 수도',
  PVG: '상하이 푸동', JFK: 'New York JFK', LAX: 'LA 국제',
};

function durationMin(from: Date, to: Date) {
  const m = Math.round((to.getTime() - from.getTime()) / 60000);
  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtDateFlight(d: Date) {
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getMonth() + 1}.${d.getDate()} (${wd})`;
}

function calcCostSummary(costs: PlanCost[]): Record<CostCategory, number> {
  const totals: Record<CostCategory, number> = {
    TRANSPORT: 0,
    ACCOMMODATION: 0,
    FOOD: 0,
    ENTRANCE: 0,
    ETC: 0,
  };
  for (const cost of costs) {
    totals[cost.category as CostCategory] += cost.amount;
  }
  return totals;
}

type FullPlan = MyPlan & { spots: PlanSpot[]; costs: PlanCost[]; flight: PlanFlight | null };

interface Props {
  plan: FullPlan;
  dayCount: number;
  deleteAction: (planId: string) => Promise<void>;
}

const PIN_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>
);

function buildTimeline(spots: PlanSpot[], costs: PlanCost[], day: number) {
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

function FlightLeg({ leg, flight }: { leg: 'out' | 'ret'; flight: PlanFlight }) {
  const isOut = leg === 'out';
  const isRoundTrip = flight.tripType === 'ROUND_TRIP';
  const origin      = isOut ? flight.outOrigin      : (flight.retOrigin ?? '');
  const destination = isOut ? flight.outDestination : (flight.retDestination ?? '');
  const departsAt   = isOut ? flight.outDepartsAt   : flight.retDepartsAt!;
  const arrivesAt   = isOut ? flight.outArrivesAt   : flight.retArrivesAt!;
  const airline     = isOut ? flight.outAirline     : (flight.retAirline ?? '');
  const flightNo    = isOut ? flight.outFlightNo    : (flight.retFlightNo ?? '');
  const duration    = durationMin(departsAt, arrivesAt);

  return (
    <div className="bg-white border-[0.5px] border-black/[0.08] rounded-[14px] px-6 py-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] mb-[10px]">
      <p className="text-[11px] text-[#888] mb-3">{isOut ? '가는편' : '오는편'}</p>
      <div className="flex items-center gap-5 flex-wrap">
        {/* 출발 공항 */}
        <div className="shrink-0 min-w-[100px]">
          <p className="text-[22px] font-bold text-[#1A1A1A] tracking-[-0.5px] leading-none">{origin}</p>
          <p className="text-[11px] text-[#888] mt-0.5">{AIRPORT_NAME[origin] ?? ''}</p>
          <p className="text-[13px] text-[#4A4A4A] font-medium mt-1.5">
            {fmtDateFlight(departsAt)} {fmtTime(departsAt)}
          </p>
        </div>

        {/* 화살표 + 소요시간 */}
        <div className="flex-1 flex flex-col items-center min-w-[80px]">
          <p className="text-[11px] text-[#888] mb-1">{duration} · 직항</p>
          <div className="w-full h-px bg-[#E0E0E0] relative">
            <span className="absolute -right-1 top-1/2 -translate-y-1/2 bg-white px-1 text-[#5C7BC9]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>
              </svg>
            </span>
          </div>
          <p className="text-[11px] text-[#888] mt-1">{airline} {flightNo}</p>
        </div>

        {/* 도착 공항 */}
        <div className="shrink-0 min-w-[100px]">
          <p className="text-[22px] font-bold text-[#1A1A1A] tracking-[-0.5px] leading-none">{destination}</p>
          <p className="text-[11px] text-[#888] mt-0.5">{AIRPORT_NAME[destination] ?? ''}</p>
          <p className="text-[13px] text-[#4A4A4A] font-medium mt-1.5">
            {fmtDateFlight(arrivesAt)} {fmtTime(arrivesAt)}
          </p>
        </div>

        {/* 가격 */}
        <div className="shrink-0 text-right min-w-[110px]">
          {isOut ? (
            <>
              <p className="text-[11px] text-[#888]">
                {isRoundTrip ? '왕복 합계(예상)' : '편도 합계(예상)'}
              </p>
              <p className="text-[18px] font-bold text-[#1A1A1A] mt-0.5">
                ₩{flight.totalAmount.toLocaleString()}
              </p>
            </>
          ) : (
            <>
              <p className="text-[11px] text-[#888]">포함</p>
              <p className="text-[18px] font-bold text-[#1A1A1A] mt-0.5">위와 동일</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function PlanDetail({ plan, dayCount, deleteAction }: Props) {
  const [selectedDay, setSelectedDay] = useState(1);
  const [isPending, startTransition] = useTransition();

  const days = Array.from({ length: dayCount }, (_, i) => i + 1);
  const timeline = buildTimeline(plan.spots, plan.costs, selectedDay);

  const costSummary = calcCostSummary(plan.costs);
  const totalPlanCost = CATEGORIES.reduce((sum, cat) => sum + costSummary[cat], 0);
  const maxPlanCost = Math.max(0, ...CATEGORIES.map((cat) => costSummary[cat]));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">{plan.title}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {plan.currency}
          {plan.startDate && plan.endDate && (
            <>
              {' · '}
              {plan.startDate.toLocaleDateString('ko-KR')} ~{' '}
              {plan.endDate.toLocaleDateString('ko-KR')}
            </>
          )}
        </p>

        {(plan.region || plan.movie) && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {plan.region && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {plan.region}
              </span>
            )}
            {plan.movie && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {plan.movie}
              </span>
            )}
          </div>
        )}

        {plan.description && (
          <div className="mt-3 bg-orange-50 border border-orange-100 rounded-[10px] p-4">
            <p className="text-xs font-semibold text-orange-400 mb-1">여행계획 간단소개</p>
            <p className="text-sm text-orange-700 whitespace-pre-wrap">{plan.description}</p>
          </div>
        )}
      </div>

      {plan.flight && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">
            항공편 (예상)
          </p>
          <FlightLeg leg="out" flight={plan.flight} />
          {plan.flight.tripType === 'ROUND_TRIP' && plan.flight.retOrigin && (
            <FlightLeg leg="ret" flight={plan.flight} />
          )}
        </div>
      )}

      <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">
        여행 일정
      </p>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {days.map((d) => (
          <button
            key={d}
            onClick={() => setSelectedDay(d)}
            className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              selectedDay === d
                ? 'bg-[#1A1A1A] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Day {d}
            {plan.startDate && (
              <span className="ml-1 text-xs opacity-60">
                {new Date(
                  plan.startDate.getTime() + (d - 1) * 86400000
                ).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="glass-outer p-5 mb-4">
        {timeline.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">항목이 없습니다.</p>
        ) : (
          <div className="flex flex-col">
            {timeline.map(({ spot, cost }, i) => {
              const isFirst = i === 0;
              const isLast = i === timeline.length - 1;
              const markerBg = 'bg-blue-500';
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
                      </div>
                      <p className="text-[12px] font-semibold text-[#4A4A4A] shrink-0">
                        {cost && cost.amount > 0
                          ? formatAmount(cost.amount, plan.currency as 'KRW' | 'USD' | 'JPY')
                          : '무료'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">
        카테고리별 비용
      </p>
      <div className="glass-outer p-5 mb-4">
        <div>
          {CATEGORIES.map((cat, idx) => {
            const barPct = maxPlanCost > 0 ? (costSummary[cat] / maxPlanCost) * 100 : 0;
            return (
              <div key={cat} style={{ marginBottom: idx < CATEGORIES.length - 1 ? 14 : 0 }}>
                <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
                  <div className="flex items-center" style={{ gap: 6 }}>
                    <span style={{ color: CATEGORY_COLOR[cat], fontSize: 13, lineHeight: 1, display: 'flex' }}>
                      {CATEGORY_ICON[cat]}
                    </span>
                    <span style={{ fontSize: 13, color: '#4A4A4A' }}>{CATEGORY_LABEL[cat]}</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#888' }}>
                    {formatAmount(costSummary[cat], plan.currency as 'KRW' | 'USD' | 'JPY')}
                  </span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ height: 5, background: 'rgba(0,0,0,0.05)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{ width: `${barPct}%`, backgroundColor: CATEGORY_COLOR[cat] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div
          className="flex justify-between"
          style={{ marginTop: 14, paddingTop: 14, borderTop: '0.5px solid rgba(0,0,0,0.08)' }}
        >
          <span style={{ fontSize: 13, color: '#666' }}>총 비용</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>
            {formatAmount(totalPlanCost, plan.currency as 'KRW' | 'USD' | 'JPY')}
          </span>
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <Link
          href={`/my-plan/${plan.id}/edit`}
          className="flex-1 py-2.5 rounded-full text-sm font-semibold text-center border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
        >
          수정
        </Link>
        <button
          type="button"
          onClick={() => {
            if (!confirm('계획을 삭제하시겠습니까?')) return;
            startTransition(() => deleteAction(plan.id));
          }}
          disabled={isPending}
          className="flex-1 py-2.5 rounded-full text-sm font-semibold bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-colors disabled:opacity-50"
        >
          {isPending ? '삭제 중...' : '삭제'}
        </button>
      </div>
    </div>
  );
}
