import 'server-only';
import { prisma } from '@/lib/prisma';
import { summarizePlanCost, type PublicCostSummary } from './summarize-plan-cost';

export type PublicPlanListItem = {
  id: string;
  title: string;
  region: string | null;
  movie: string | null;
  createdAt: Date;
  likeCount: number;
  isLiked: boolean;
  authorNickname: string;
  summary: PublicCostSummary;
};

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
      _count: { select: { planLikes: true } },
      costs: { select: { category: true, amount: true } },
      flight: { select: { totalAmount: true } },
      owner: { select: { nickname: true } },
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
    likeCount: plan._count.planLikes,
    isLiked: likedSet.has(plan.id),
    authorNickname: plan.owner.nickname,
    summary: summarizePlanCost(
      plan.costs,
      plan.flight,
      plan.currency as 'KRW' | 'USD' | 'JPY',
    ),
  }));
}
