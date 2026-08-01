import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { StoryWriteForm } from '@/app/(protected)/story/new/StoryWriteForm';
import { updateStoryAction } from '../actions';
import { summarizePlanCost } from '@/lib/plan/summarize-plan-cost';
import { buildPlanSummaryLine } from '@/lib/plan/summary-line';

export default async function StoryEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const story = await prisma.story.findUnique({
    where: { id },
    // 편집 로드: story_spots 기준(재사용 스팟 포함 — owned만인 story.spots로는 재사용 스팟이 안 잡힘).
    include: {
      tags: true,
      storySpots: {
        orderBy: { order: 'asc' },
        select: {
          order: true, review: true, photoUrl: true, rating: true,
          // 작품은 spot_movies 조인(복수) — 재사용 seed 스팟은 레거시 movieId가 null이라 조인에서 도출.
          spot: { include: { spotMovies: { orderBy: { createdAt: 'desc' }, select: { movie: { select: { id: true, title: true } } } } } },
        },
      },
    },
  });
  if (!story) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== story.userId) redirect(`/story/${id}`);

  const plans = await prisma.myPlan.findMany({
    where: {
      ownerId: user.id,
      OR: [{ story: null }, { story: { id: story.id } }],
    },
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
  // 요약 한 줄은 서버에서 문자열로 완성해 내림 — 원 금액 비노출(new/page.tsx와 동일 패턴)
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
      band: summarizePlanCost(p.costs, p.flight, p.currency as 'KRW' | 'USD' | 'JPY').band,
    }),
  }));

  const boundAction = updateStoryAction.bind(null, story.id);

  // 글쓰기 폭 단일 소스(0313 원칙) — 헤더·폼·SpotMap이 이 폭을 상속
  return (
    <div className="max-w-[860px] mx-auto">
      <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-primary">EDIT</p>
      <h1 className="text-[20px] font-bold text-fg mt-[7px] mb-6 break-keep">그 날의 기억을 다시 다듬어보세요</h1>
      <StoryWriteForm
        action={boundAction}
        initialData={{ title: story.title, content: story.content, tags: story.tags.map((t) => t.name) }}
        userId={user.id}
        storySpots={story.storySpots}
        storyId={story.id}
        availablePlans={availablePlans}
        initialPlanId={story.planId}
      />
    </div>
  );
}
