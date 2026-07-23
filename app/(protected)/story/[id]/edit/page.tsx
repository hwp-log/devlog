import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { StoryWriteForm } from '@/app/(protected)/story/new/StoryWriteForm';
import { updateStoryAction } from '../actions';

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

  const availablePlans = await prisma.myPlan.findMany({
    where: {
      ownerId: user.id,
      OR: [{ story: null }, { story: { id: story.id } }],
    },
    select: {
      id: true, title: true, currency: true,
      costs: { select: { category: true, amount: true } },
      flight: { select: { totalAmount: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const boundAction = updateStoryAction.bind(null, story.id);

  // 글쓰기 폭 단일 소스(0313 원칙) — 헤더·폼·SpotMap이 이 폭을 상속
  return (
    <div className="max-w-[860px] mx-auto">
      <p className="text-[12px] font-medium uppercase tracking-wider text-primary">EDIT</p>
      <h1 className="text-2xl font-bold text-fg mb-6 break-keep">그 날의 기억을 다시 다듬어보세요</h1>
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
