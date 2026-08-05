'use client';
import { useState, useTransition, useOptimistic } from 'react';
import Link from 'next/link';
import type { MyPlan, PlanSpot, PlanCost, PlanFlight } from '@prisma/client';
import { FlightLeg, type FlightLegData } from '../_components/FlightLeg';
import { CostSection } from '../_components/CostSection';
import { PlanTimeline, buildTimeline, type TimelineItem } from '../_components/PlanTimeline';
import { calcPlanTotal } from '@/lib/plan/calc-plan-total';
import { calcCostSummary } from '@/lib/plan/calc-cost-summary';
import { CATEGORY_LABEL, formatAmount, type CostCategory } from '../_lib/cost';
import { togglePlanPublicAction } from './actions';

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


type FullPlan = MyPlan & { spots: PlanSpot[]; costs: PlanCost[]; flight: PlanFlight | null };

interface Props {
  plan: FullPlan;
  dayCount: number;
  deleteAction: (planId: string) => Promise<void>;
}


export function PlanDetail({ plan, dayCount, deleteAction }: Props) {
  const [selectedDay, setSelectedDay] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [isPendingPublic, startPublicTransition] = useTransition();
  const [optimisticPublic, setOptimisticPublic] = useOptimistic(
    plan.isPublic,
    (_, next: boolean) => next,
  );

  const handleTogglePublic = () => {
    const next = !optimisticPublic;
    startPublicTransition(async () => {
      setOptimisticPublic(next);
      await togglePlanPublicAction(plan.id, next);
    });
  };

  const days = Array.from({ length: dayCount }, (_, i) => i + 1);
  const timeline: TimelineItem[] = buildTimeline(plan.spots, plan.costs, selectedDay);

  const costSummary = calcCostSummary(plan.costs);
  const flightAmount = plan.flight?.totalAmount ?? 0;
  const total = calcPlanTotal(plan.costs, plan.flight);
  // 0504 2단계: 무장소 비용(day·planSpotId 둘 다 NULL) — 타임라인엔 안 떠서 소유자에게 별도 표시.
  //   총액·카테고리 바엔 이미 합산됨(표시만 추가, 재합산 아님).
  const daylessCosts = plan.costs.filter((c) => c.day == null && c.planSpotId == null);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{plan.title}</h1>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/my-plan/${plan.id}/edit`}
              className="px-4 py-1.5 rounded-full text-sm bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors"
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
              className="px-4 py-1.5 rounded-full text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {isPending ? '삭제 중...' : '삭제'}
            </button>
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={handleTogglePublic}
              disabled={isPendingPublic}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors disabled:opacity-50 ${
                optimisticPublic
                  ? 'bg-[#1A1A1A] text-white hover:bg-[#333]'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {optimisticPublic ? '공개 중' : '비공개'}
            </button>
            <p className="mt-1.5 text-xs text-slate-400">
              공개하면 비용이 비중·구간으로 가공되어 표시됩니다 (정밀 금액은 비공개)
            </p>
          </div>
        </div>
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

      {/* 0504 2단계: 여행 전체 비용 — 항공편 아래·여행 일정 위(항공→여행 전체→Day 순서 일치).
          항목 있을 때만 렌더(읽기 전용). 행은 PublicCostSection itemGroups와 동형(label·카테고리·금액). */}
      {daylessCosts.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">
            여행 전체 비용
          </p>
          <div className="glass-outer p-5 flex flex-col gap-2">
            {daylessCosts.map((c) => (
              <div key={c.id} className="flex items-baseline gap-2 text-sm">
                <span className="text-[#1A1A1A] break-keep">{c.label}</span>
                <span className="text-xs text-slate-400 shrink-0">{CATEGORY_LABEL[c.category as CostCategory]}</span>
                <span className="ml-auto shrink-0 font-medium text-[#1A1A1A]">
                  {formatAmount(c.amount, plan.currency as 'KRW' | 'USD' | 'JPY')}
                </span>
              </div>
            ))}
          </div>
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
      <PlanTimeline items={timeline} currency={plan.currency as 'KRW' | 'USD' | 'JPY'} />

      <CostSection
        totals={costSummary}
        flightAmount={flightAmount}
        total={total}
        currency={plan.currency as 'KRW' | 'USD' | 'JPY'}
      />

      <div className="mt-4 flex flex-col gap-2">
        {plan.sourcePlanId && (
          <Link
            href={`/plan-finder/${plan.sourcePlanId}`}
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            원본 플랜 보기 →
          </Link>
        )}
        <Link href="/my-plan" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
          ← 목록으로
        </Link>
      </div>
    </div>
  );
}
