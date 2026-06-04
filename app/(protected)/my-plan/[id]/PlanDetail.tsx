'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { MyPlan, PlanSpot, PlanCost, PlanFlight } from '@prisma/client';
import {
  CATEGORY_COLOR,
  formatAmount,
  type CostCategory,
} from '../_lib/cost';
import { FlightLeg, type FlightLegData } from '../_components/FlightLeg';
import { CostSection, CATEGORY_ICON } from '../_components/CostSection';

function planFlightToLegData(f: PlanFlight): FlightLegData {
  return {
    tripType: f.tripType as 'ONE_WAY' | 'ROUND_TRIP',
    totalAmount: f.totalAmount,
    out: {
      origin: f.outOrigin,
      destination: f.outDestination,
      departsAt: f.outDepartsAt.toISOString(),
      arrivesAt: f.outArrivesAt.toISOString(),
      airline: f.outAirline,
      flightNo: f.outFlightNo,
    },
    ...(f.retOrigin ? {
      ret: {
        origin: f.retOrigin,
        destination: f.retDestination!,
        departsAt: f.retDepartsAt!.toISOString(),
        arrivesAt: f.retArrivesAt!.toISOString(),
        airline: f.retAirline!,
        flightNo: f.retFlightNo!,
      },
    } : {}),
  };
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

export function PlanDetail({ plan, dayCount, deleteAction }: Props) {
  const [selectedDay, setSelectedDay] = useState(1);
  const [isPending, startTransition] = useTransition();

  const days = Array.from({ length: dayCount }, (_, i) => i + 1);
  const timeline = buildTimeline(plan.spots, plan.costs, selectedDay);

  const costSummary = calcCostSummary(plan.costs);
  const flightAmount = plan.flight?.totalAmount ?? 0;

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
          <div className="mt-3 glass-outer p-4">
            <p className="text-xs font-semibold text-slate-500 mb-1">여행계획 간단소개</p>
            <p className="text-sm text-[#1A1A1A] whitespace-pre-wrap">{plan.description}</p>
          </div>
        )}
      </div>

      {plan.flight && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">
            항공편 (예상)
          </p>
          <FlightLeg data={planFlightToLegData(plan.flight)} />
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

      <CostSection
        totals={costSummary}
        flightAmount={flightAmount}
        currency={plan.currency as 'KRW' | 'USD' | 'JPY'}
      />

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
