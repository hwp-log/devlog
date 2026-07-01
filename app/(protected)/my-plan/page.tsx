import Link from 'next/link';
import { Map, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { calcPlanTotal } from '@/lib/plan/calc-plan-total';
import { summarizePlanCost } from '@/lib/plan/summarize-plan-cost';
import { getAvatarInfo } from '@/lib/avatar/generate';
import { MyPlanListClient, type MyPlanListItem } from './_components/MyPlanListClient';

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

  const items: MyPlanListItem[] = plans.map((plan) => {
    const currency = plan.currency as 'KRW' | 'USD' | 'JPY';
    const summary = summarizePlanCost(plan.costs, plan.flight, currency);
    return {
      id: plan.id,
      title: plan.title,
      region: plan.region,
      currency,
      startDate: plan.startDate,
      endDate: plan.endDate,
      createdAt: plan.createdAt,
      spotCount: plan._count.spots,
      total: calcPlanTotal(plan.costs, plan.flight),
      band: summary.band,
      ratios: summary.ratios,
    };
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
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
          </div>
        </div>
        <Link
          href="/my-plan/new"
          className="bg-[#1A1A1A] text-white px-5 py-2 rounded-full text-sm appear-up transition-all duration-500 ease-in-out hover:-translate-y-[3px] hover:bg-[#333] active:translate-y-0 active:scale-[0.96] active:duration-100"
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
        <MyPlanListClient items={items} />
      )}
    </div>
  );
}
