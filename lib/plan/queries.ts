import 'server-only';
import { prisma } from '@/lib/prisma';
import { summarizePlanCost, type PublicCostSummary } from './summarize-plan-cost';

export type PublicPlanListItem = {
  id: string;
  title: string;
  region: string | null;
  movie: string | null;
  createdAt: Date;
  coverUrl: string | null;
  headcount: number;
  spotCount: number;
  dayCount: number | null;
  likeCount: number;
  isLiked: boolean;
  authorNickname: string;
  authorAvatarUrl: string | null;
  summary: PublicCostSummary;
};

/** 0557: 플랜 가시성 — 공개이거나 내 것. 비공개는 "금액 가공"이 아니라 글 자체를 가린다(재정의).
 *  소비처: 공개 상세(plan-finder/[id]/page)·좋아요·담기(plan-finder/[id]/actions).
 *  공개 목록(fetchPublicPlans)은 미적용 — 목록은 접근 제어가 아니라 공개 진열 기준이라
 *  내 비공개가 섞이면 목록의 의미가 깨진다(내 비공개는 /my-plan 담당). */
export function visiblePlanWhere(viewerId?: string | null) {
  return { OR: [{ isPublic: true }, ...(viewerId ? [{ ownerId: viewerId }] : [])] };
}

export async function fetchPublicPlans(userId?: string): Promise<PublicPlanListItem[]> {
  const plans = await prisma.myPlan.findMany({
    where: { isPublic: true },
    select: {
      id: true,
      title: true,
      region: true,
      movie: true,
      currency: true,
      createdAt: true,
      coverUrl: true,
      headcount: true,
      startDate: true,
      endDate: true,
      _count: { select: { planLikes: true, spots: true } },
      costs: { select: { category: true, amount: true } },
      flight: { select: { totalAmount: true } },
      owner: { select: { nickname: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  let likedSet = new Set<string>();
  if (userId) {
    const likes = await prisma.planLike.findMany({
      where: { userId, planId: { in: plans.map((p) => p.id) } },
      select: { planId: true },
    });
    likedSet = new Set(likes.map((l) => l.planId));
  }

  return plans.map((plan) => ({
    id: plan.id,
    title: plan.title,
    region: plan.region,
    movie: plan.movie,
    createdAt: plan.createdAt,
    coverUrl: plan.coverUrl,
    headcount: plan.headcount,
    spotCount: plan._count.spots,
    dayCount:
      plan.startDate && plan.endDate
        ? Math.max(1, Math.ceil((plan.endDate.getTime() - plan.startDate.getTime()) / 86_400_000) + 1)
        : null,
    likeCount: plan._count.planLikes,
    isLiked: likedSet.has(plan.id),
    authorNickname: plan.owner.nickname,
    authorAvatarUrl: plan.owner.avatarUrl,
    summary: summarizePlanCost(
      plan.costs,
      plan.flight,
      plan.currency as 'KRW' | 'USD' | 'JPY',
      plan.headcount, // 0587: 항공은 1인 요금 — 인원 반영(정본 lib/plan/calc-plan-total.ts)
    ),
  }));
}
