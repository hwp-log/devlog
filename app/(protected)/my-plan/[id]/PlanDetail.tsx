'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { MyPlan, PlanSpot, PlanCost } from '@prisma/client';
import {
  CATEGORIES,
  CATEGORY_LABEL,
  CATEGORY_COLOR,
  formatAmount,
  type CostCategory,
} from '../_lib/cost';

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

type FullPlan = MyPlan & { spots: PlanSpot[]; costs: PlanCost[] };

interface Props {
  plan: FullPlan;
  dayCount: number;
  deleteAction: (planId: string) => Promise<void>;
}

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

      <div className="glass-outer p-6 mb-4">
        {timeline.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">항목이 없습니다.</p>
        ) : (
          <ol className="relative border-l border-slate-200 ml-3 space-y-6">
            {timeline.map(({ spot, cost }, i) => (
              <li key={spot.id} className="ml-6">
                <span className="absolute -left-[9px] flex items-center justify-center w-[18px] h-[18px] rounded-full bg-blue-500 text-white text-[10px] font-bold">
                  {i + 1}
                </span>
                <p className="font-medium text-[#1A1A1A]">{spot.name}</p>
                {cost ? (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {CATEGORY_LABEL[cost.category]} · {cost.amount.toLocaleString()}원
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-0.5">비용 미지정</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* 카테고리 비용 요약 (읽기 전용) */}
      <div className="glass-outer p-5 mb-4">
        <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">
          카테고리별 비용
        </p>
        <div className="flex flex-col gap-2">
          {CATEGORIES.map((cat) => {
            const barPct =
              maxPlanCost > 0 ? (costSummary[cat] / maxPlanCost) * 100 : 0;
            return (
              <div key={cat} className="flex items-center text-sm gap-2">
                <span className="text-slate-600 w-16 shrink-0">{CATEGORY_LABEL[cat]}</span>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{ width: `${barPct}%`, backgroundColor: CATEGORY_COLOR[cat] }}
                  />
                </div>
                <span className="text-slate-500 text-xs w-24 text-right shrink-0">
                  {formatAmount(costSummary[cat], plan.currency as 'KRW' | 'USD' | 'JPY')}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-sm font-semibold">
          <span className="text-[#1A1A1A]">총 비용</span>
          <span className="text-[#1A1A1A]">
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
