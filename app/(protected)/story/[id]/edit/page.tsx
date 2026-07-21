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

  return (
    <div className="max-w-7xl mx-auto">
      <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-fg mb-2">스토리 수정</h1>
      <p className="text-sm text-muted mb-6">내용을 수정하고 저장하세요</p>
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
    </div>
  );
}
