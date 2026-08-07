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
      // 0530: 카드가 커버·좋아요 수를 쓰므로 planLikes 집계 추가.
      _count: { select: { spots: true, planLikes: true } },
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
      movie: plan.movie,
      coverUrl: plan.coverUrl,
      currency,
      startDate: plan.startDate,
      endDate: plan.endDate,
      createdAt: plan.createdAt,
      spotCount: plan._count.spots,
      headcount: plan.headcount,
      total: calcPlanTotal(plan.costs, plan.flight),
      band: summary.band,
      isPublic: plan.isPublic,
      isDraft: plan.isDraft,
      likeCount: plan._count.planLikes,
    };
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
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
          <div>
            {/* 하드코딩 #1A1A1A·sky-500 → 토큰(다크에서 검정 제목이 배경에 묻히던 것도 함께 해소). */}
            <p className="text-xs font-semibold text-primary mb-1">MyPlan</p>
            <h1 className="text-[21px] md:text-[28px] font-bold tracking-[-0.02em] text-fg break-keep">
              {headline}
            </h1>
          </div>
        </div>
        {/* 검정이면 헤더의 파랑 Write와 급이 헷갈린다 → 같은 primary 면으로 통일.
            글자는 사용자 지시로 흰색(0529 주요 버튼과 동일 선택). 높이 44px = §5 터치 타겟 하한. */}
        <Link
          href="/my-plan/new"
          className="shrink-0 inline-flex items-center gap-1.5 bg-primary text-white px-[18px] min-h-11 rounded-full text-sm font-semibold transition-all duration-500 ease-in-out hover:-translate-y-[3px] hover:opacity-90 active:translate-y-0 active:scale-[0.96] active:duration-100"
        >
          <Plus size={15} />
          새 계획
        </Link>
      </div>

      {plans.length === 0 ? (
        // 빈 판 높이 = 카드 한 장(240/280px). 첫 계획이 생겼을 때 레이아웃이 뛰지 않는다.
        <div
          className="border-[1.5px] border-dashed border-border rounded-[14px] p-[22px] h-[240px] sm:h-[280px] flex flex-col items-center justify-center text-center"
        >
          <Map size={34} strokeWidth={1.5} className="text-muted mb-3" />
          <p className="text-fg font-medium mb-1">아직 여행 계획이 없어요</p>
          <p className="text-muted text-sm mb-4">첫 여행을 계획해보세요</p>
          <Link
            href="/my-plan/new"
            className="inline-flex items-center gap-1.5 bg-primary text-white px-[18px] min-h-11 rounded-full text-sm font-semibold transition-all duration-500 ease-in-out hover:-translate-y-[3px] hover:opacity-90 active:translate-y-0 active:scale-[0.96] active:duration-100"
          >
            <Plus size={15} />
            새 계획
          </Link>
        </div>
      ) : (
        <MyPlanListClient items={items} />
      )}
    </div>
  );
}
