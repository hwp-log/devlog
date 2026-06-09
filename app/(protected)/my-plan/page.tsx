import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { CATEGORIES, CATEGORY_COLOR, CATEGORY_LABEL, FLIGHT_COLOR, formatAmount } from './_lib/cost';
import { calcCostSummary } from '@/lib/plan/calc-cost-summary';
import { calcPlanTotal } from '@/lib/plan/calc-plan-total';

export default async function MyPlanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const plans = await prisma.myPlan.findMany({
    where: { ownerId: user!.id },
    orderBy: { createdAt: 'desc' },
    include: {
      costs: true,
      flight: true,
      _count: { select: { spots: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">My Plan</h1>
        <Link
          href="/my-plan/new"
          className="bg-[#1A1A1A] text-white px-5 py-2 rounded-full text-sm"
        >
          새 계획
        </Link>
      </div>

      {plans.length === 0 ? (
        <div className="glass-outer p-12 text-center">
          <p className="text-slate-500">아직 계획이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const summary = calcCostSummary(plan.costs);
            const total = calcPlanTotal(plan.costs, plan.flight);
            const isEmpty = total === 0;
            const flightAmt = plan.flight?.totalAmount ?? 0;

            return (
              <Link
                key={plan.id}
                href={`/my-plan/${plan.id}`}
                className="glass-outer glass-outer-interactive overflow-hidden block cursor-pointer"
              >
                <div className="p-5">
                  {/* 제목 + chevron */}
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h2 className="text-base font-semibold text-[#1A1A1A] leading-snug">{plan.title}</h2>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400 mt-0.5">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>

                  {/* 메타: 기간 · 스팟 수 */}
                  <p className="text-xs text-slate-400 mb-4">
                    {plan.startDate && plan.endDate
                      ? `${plan.startDate.toLocaleDateString('ko-KR')} ~ ${plan.endDate.toLocaleDateString('ko-KR')}`
                      : '기간 미설정'}
                    {' · '}
                    스팟 {plan._count.spots}개
                  </p>

                  {isEmpty ? (
                    <p className="text-xs text-slate-400 py-3">예산 미입력</p>
                  ) : (
                    <>
                      {/* 누적 막대 */}
                      <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 mb-3">
                        {flightAmt > 0 && (
                          <div style={{ width: `${(flightAmt / total) * 100}%`, backgroundColor: FLIGHT_COLOR }} />
                        )}
                        {CATEGORIES.map((cat) =>
                          summary[cat] > 0 ? (
                            <div
                              key={cat}
                              style={{ width: `${(summary[cat] / total) * 100}%`, backgroundColor: CATEGORY_COLOR[cat] }}
                            />
                          ) : null
                        )}
                      </div>

                      {/* 총액 */}
                      <p className="text-right text-xl font-bold text-[#1A1A1A] mb-3">
                        {formatAmount(total, plan.currency as 'KRW' | 'USD' | 'JPY')}
                      </p>

                      {/* 범례: 비용 > 0 항목만 */}
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {flightAmt > 0 && (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: FLIGHT_COLOR }} />
                            항공
                          </span>
                        )}
                        {CATEGORIES.map((cat) =>
                          summary[cat] > 0 ? (
                            <span key={cat} className="flex items-center gap-1 text-xs text-slate-500">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLOR[cat] }} />
                              {CATEGORY_LABEL[cat]}
                            </span>
                          ) : null
                        )}
                      </div>
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
