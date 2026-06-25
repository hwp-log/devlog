import Link from 'next/link';
import type { LocalSpot } from '@/lib/types';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { DeleteButton } from './DeleteButton';
import { LikeButton } from './LikeButton';
import SpotMap from '@/components/SpotMapWrapper';
import { MapPin, Wallet } from 'lucide-react';
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
        spots: { include: { movie: { select: { title: true } } }, orderBy: { order: 'asc' } },
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

  const localSpots: LocalSpot[] = story.spots.map((s) => ({
    id: s.id, name: s.name, lat: s.lat, lng: s.lng, order: s.order,
    photoUrl: s.photoUrl, review: s.review, address: s.address, description: s.description,
    movieId: s.movieId ?? null,
    movieTitle: s.movie?.title ?? null,
  }));

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
            className="tiptap-content text-base text-slate-800 leading-relaxed mb-6"
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
      {story.spots.length > 0 && (
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
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#1A1A1A] mb-4">
            <Wallet size={16} />
            예산 요약
          </h2>
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
