import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { StoryWriteForm } from './StoryWriteForm';
import { createStoryAction } from './actions';
import { summarizePlanCost } from '@/lib/plan/summarize-plan-cost';
import { buildPlanSummaryLine } from '@/lib/plan/summary-line';

export default async function StoryNewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const plans = await prisma.myPlan.findMany({
    where: { ownerId: user.id, story: null },
    select: {
      id: true, title: true, description: true, currency: true, coverUrl: true,
      // 요약 한 줄(일수·스팟·인원·금액) 소스 — 상세 PLAN 카드와 동일 필드(0459 정합)
      startDate: true, endDate: true, headcount: true, isPublic: true,
      _count: { select: { spots: true } },
      costs: { select: { category: true, amount: true } },
      flight: { select: { totalAmount: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  // 요약 한 줄은 server-only(summarizePlanCost total → buildPlanSummaryLine) — 여기서 문자열로
  // 완성해 내림. 원 금액(costs·flight)은 안 내림(상세·plan-finder와 동일 공개 수준).
  const availablePlans = plans.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    coverUrl: p.coverUrl,
    summaryLine: buildPlanSummaryLine({
      startDate: p.startDate,
      endDate: p.endDate,
      spotCount: p._count.spots,
      headcount: p.headcount,
      showCost: p.isPublic,
      // 0587: 항공은 1인 요금 — 인원 반영(정본 lib/plan/calc-plan-total.ts)
      total: summarizePlanCost(p.costs, p.flight, p.currency as 'KRW' | 'USD' | 'JPY', p.headcount).total,
      currency: p.currency as 'KRW' | 'USD' | 'JPY',
    }),
  }));

  // 글쓰기 폭 단일 소스(0313 원칙) — 헤더·폼·SpotMap이 이 폭을 상속
  return (
    <div className="max-w-[var(--story-content-w)] mx-auto">
        <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-primary">WRITE</p>
        <h1 className="text-[20px] font-bold text-fg mt-[7px] mb-6 break-keep">다녀온 촬영지를 이야기로 남겨보세요</h1>
        <StoryWriteForm action={createStoryAction} userId={user.id} availablePlans={availablePlans} />
    </div>
  );
}
