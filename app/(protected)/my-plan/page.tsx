import Link from 'next/link';
import { Map, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { CATEGORIES, CATEGORY_COLOR, CATEGORY_LABEL, FLIGHT_COLOR, formatAmount } from './_lib/cost';
import { calcCostSummary } from '@/lib/plan/calc-cost-summary';
import { calcPlanTotal } from '@/lib/plan/calc-plan-total';
import { getAvatarInfo } from '@/lib/avatar/generate';

export default async function MyPlanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const profile = await prisma.user.findUnique({
    where: { id: user!.id },
    select: { nickname: true, avatarUrl: true },
  });

  const plans = await prisma.myPlan.findMany({
    where: { ownerId: user!.id },
    orderBy: { createdAt: 'desc' },
    include: {
      costs: true,
      flight: true,
      _count: { select: { spots: true } },
    },
  });

  const nickname = profile?.nickname ?? '';
  const headline = plans.length > 0
    ? `${nickname}님의 여행 계획들`
    : `${nickname}님, 첫 여행을 계획해볼까요?`;
  const avatar = getAvatarInfo(nickname);

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="appear-up" style={{ animationDelay: '0s' }}>
            {profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt=""
                className="w-14 h-14 rounded-full object-cover shrink-0"
              />
            ) : (
              <span
                className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white shrink-0"
                style={{ backgroundColor: avatar.color }}
                aria-label={`${nickname} 아바타`}
              >
                {avatar.initial}
              </span>
            )}
          </div>
          <div>
            <h1
              className="text-2xl md:text-3xl font-bold text-[#1A1A1A] appear-up"
              style={{ animationDelay: '0.12s' }}
            >
              {headline}
            </h1>
            <p
              className="text-sm text-slate-500 mt-1 appear-up"
              style={{ animationDelay: '0.18s' }}
            >
              {plans.length}개 계획
            </p>
          </div>
        </div>
        <Link
          href="/my-plan/new"
          className="bg-[#1A1A1A] text-white px-5 py-2 rounded-full text-sm appear-up"
          style={{ animationDelay: '0.24s' }}
        >
          새 계획
        </Link>
      </div>

      {plans.length === 0 ? (
        <div
          className="glass-outer p-12 h-[calc(100vh-208px)] min-h-[440px] flex flex-col items-center justify-center text-center appear-up"
          style={{ animationDelay: '0.36s' }}
        >
          <Map size={40} strokeWidth={1.5} className="text-slate-300 mb-3" />
          <p className="text-slate-700 font-medium mb-1">아직 여행 계획이 없어요</p>
          <p className="text-slate-500 text-sm mb-5">첫 여행을 계획해보세요</p>
          <Link
            href="/my-plan/new"
            className="inline-flex items-center gap-1.5 bg-[#1A1A1A] text-white px-5 py-2 rounded-full text-sm transition-all duration-500 ease-in-out hover:-translate-y-[3px] hover:bg-[#333] active:translate-y-0 active:scale-[0.96] active:duration-100"
          >
            <Plus size={14} />
            새 계획
          </Link>
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
