import Link from 'next/link';
import type { LocalSpot } from '@/lib/types';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { DeleteButton } from './DeleteButton';
import { LikeButton } from './LikeButton';
import SpotMap from '@/components/SpotMapWrapper';
import { MapPin } from 'lucide-react';
import { summarizePlanCost } from '@/lib/plan/summarize-plan-cost';
import { PublicCostSection } from './PublicCostSection';
import { AuthorAvatar } from '@/components/AuthorAvatar';

export default async function StoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  const [story, myLike] = await Promise.all([
    prisma.story.findUnique({
      where: { id },
      include: {
        tags: true,
        // S2 미전환분 수정: story_spots 조인 기준 (S3-a 재사용 스팟은 owned Spot이 없어 story.spots로는 안 잡힘).
        storySpots: {
          orderBy: { order: 'asc' },
          select: {
            order: true, review: true, photoUrl: true, rating: true,
            // 작품은 spot_movies 조인(복수) — 레거시 spot.movie(단수)는 재사용 seed 스팟에서 null이라 누락됨.
            spot: { include: { spotMovies: { orderBy: { createdAt: 'desc' }, select: { movie: { select: { id: true, title: true } } } } } },
          },
        },
        plan: {
          select: {
            isPublic: true,
            currency: true,
            costs: { select: { category: true, amount: true } },
            flight: { select: { totalAmount: true } },
          },
        },
        _count: { select: { likes: true } },
        user: { select: { nickname: true, avatarUrl: true } },
      },
    }),
    currentUser
      ? prisma.like.findUnique({
          where: { storyId_userId: { storyId: id, userId: currentUser.id } },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  if (!story) notFound();

  // per-visit(order/review/photoUrl/rating)은 story_spot 조인에서, per-place(name/좌표/작품/주소)는 spot에서.
  // 작품: spot_movies 최신 연결순(0185 대표 규칙) → 대표 1개 + extraMovieCount("+N"). SpotFinder와 동일 정책.
  const localSpots: LocalSpot[] = story.storySpots.map((ss) => {
    const movies = ss.spot.spotMovies.map((sm) => sm.movie);
    return {
      id: ss.spot.id, name: ss.spot.name, lat: ss.spot.lat, lng: ss.spot.lng, order: ss.order,
      photoUrl: ss.photoUrl, review: ss.review, address: ss.spot.address, description: ss.spot.description,
      movieId: movies[0]?.id ?? null,
      movieTitle: movies[0]?.title ?? null,
      extraMovieCount: Math.max(0, movies.length - 1),
      rating: ss.rating ?? null,
    };
  });

  const isOwner = currentUser?.id === story.userId;

  const publicSummary = story.plan
    ? summarizePlanCost(
        story.plan.costs,
        story.plan.flight,
        story.plan.currency as 'KRW' | 'USD' | 'JPY',
      )
    : null;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="max-w-4xl mx-auto">
      <div className="glass-outer p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-6">
            <h1 className="text-3xl font-bold text-[#1A1A1A] leading-tight">{story.title}</h1>
            {isOwner && (
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/story/${story.id}/edit`}
                  className="px-4 py-1.5 rounded-full text-sm bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors"
                >
                  수정
                </Link>
                <DeleteButton storyId={story.id} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
            <span>{story.createdAt.toLocaleDateString('ko-KR')}</span>
            <span>·</span>
            <AuthorAvatar nickname={story.user.nickname} avatarUrl={story.user.avatarUrl} />
            <span>{story.user.nickname}</span>
          </div>
          <div
            className="tiptap-content text-base leading-relaxed mb-6"
            dangerouslySetInnerHTML={{ __html: story.content }}
          />
          {story.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-4">
              {story.tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/story?q=${encodeURIComponent(tag.name)}`}
                  className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 cursor-pointer hover:bg-slate-200 transition-colors"
                >
                  #{tag.name}
                </Link>
              ))}
            </div>
          )}
          <LikeButton
            storyId={story.id}
            initialLiked={!!myLike}
            initialCount={story._count.likes}
            isLoggedIn={!!currentUser}
          />
        </div>
      </div>
      {story.storySpots.length > 0 && (
        <div className="mt-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#1A1A1A] mb-4">
            <MapPin size={16} />
            여행동선
          </h2>
          <SpotMap spots={localSpots} readOnly />
        </div>
      )}
      {story.plan && publicSummary && (
        <div className="mt-6">
          {/* 눈썹 클래스 = 0342 SPOTMAP 눈썹과 동일 문자열. 공용 <Eyebrow> 추출은 후속 정리 */}
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-primary">BUDGET</p>
          <h2 className="text-[20px] font-bold tracking-[-0.02em] text-fg mt-[6px] mb-[16px] break-keep">예산 요약</h2>
          <PublicCostSection summary={publicSummary} />
        </div>
      )}
      <div className="mt-4 flex justify-between items-center">
        <Link href="/story" className="text-xs text-slate-500 hover:text-slate-800 transition-colors">
          ← 목록으로
        </Link>
        {story.plan?.isPublic && story.planId && (
          <Link href={`/plan-finder/${story.planId}`} className="text-xs text-slate-500 hover:text-slate-800 transition-colors">
            이 여행플랜 보기 →
          </Link>
        )}
      </div>
      </div>
    </div>
  );
}
