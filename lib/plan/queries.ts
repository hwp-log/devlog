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
  summary: PublicCostSummary;
};

export async function fetchPublicPlans(): Promise<PublicPlanListItem[]> {
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
    },
    orderBy: { createdAt: 'desc' },
  });

  return plans.map((plan) => ({
    id: plan.id,
    title: plan.title,
    region: plan.region,
    movie: plan.movie,
    createdAt: plan.createdAt,
    likeCount: plan._count.planLikes,
    summary: summarizePlanCost(
      plan.costs,
      plan.flight,
      plan.currency as 'KRW' | 'USD' | 'JPY',
    ),
  }));
}
