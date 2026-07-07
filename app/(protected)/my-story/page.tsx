import { ViewTransition } from 'react';
import Link from 'next/link';
import { MapPin, PenSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { extractFirstImage, extractTextPreview } from '@/lib/story/extract-thumbnail';
import { fetchStoriesWithMeta, fetchMyStoryTags } from '@/lib/story/queries';
import { getAvatarInfo } from '@/lib/avatar/generate';
import { TagSearchBar } from '@/app/story/_components/TagSearchBar';
import { MyStoryCardGrid } from './_components/MyStoryCardGrid';

export default async function MyStoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const profile = await prisma.user.findUnique({
    where: { id: user!.id },
    select: { nickname: true, avatarUrl: true },
  });

  const { q } = await searchParams;
  const keyword = q?.trim() ?? '';

  const stories = await fetchStoriesWithMeta({ userId: user!.id, tag: keyword || undefined });
  const myTags = await fetchMyStoryTags(user!.id);

  const myLikedIds = new Set<string>();
  if (stories.length > 0) {
    const myLikes = await prisma.like.findMany({
      where: { userId: user!.id, storyId: { in: stories.map((s) => s.id) } },
      select: { storyId: true },
    });
    myLikes.forEach((l) => myLikedIds.add(l.storyId));
  }

  const listKey = stories.map(s => s.id).join('-') || '__empty__';

  const nickname = profile?.nickname ?? '';
  const likeSum = stories.reduce((s, x) => s + x._count.likes, 0);
  const headline = stories.length > 0
    ? `${nickname}님의 소중한 기록들`
    : `${nickname}님, 첫 기록을 시작해볼까요?`;
  const avatar = getAvatarInfo(nickname);

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="appear-up" style={{ animationDelay: '0s' }}>
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
          </div>
          <div>
            <p
              className="text-xs font-semibold text-sky-500 mb-1 appear-up"
              style={{ animationDelay: '0s' }}
            >
              MyStory
            </p>
            <h1
              className="text-xl md:text-3xl font-bold text-[#1A1A1A] break-keep appear-up"
              style={{ animationDelay: '0.12s' }}
            >
              {headline}
            </h1>
            <p
              className="text-sm text-slate-500 mt-1 appear-up"
              style={{ animationDelay: '0.18s' }}
            >
              {stories.length} 게시물 · {likeSum} 좋아요
            </p>
          </div>
        </div>
        <div className="appear-up w-full md:w-auto" style={{ animationDelay: '0.24s' }}>
          <TagSearchBar q={keyword} basePath="/my-story" tags={myTags} />
        </div>
      </div>

      <ViewTransition key={listKey} default="list-fade">
        {stories.length === 0 ? (
          keyword ? (
            <div className="glass-outer p-12 text-center">
              <p className="text-slate-500">{`"${keyword}" 태그가 포함된 스토리가 없습니다`}</p>
            </div>
          ) : (
            <div
              className="glass-outer p-12 h-[calc(100vh-208px)] min-h-[440px] flex flex-col items-center justify-center text-center appear-up"
              style={{ animationDelay: '0.36s' }}
            >
              <MapPin size={40} strokeWidth={1.5} className="text-slate-300 mb-3" />
              <p className="text-slate-700 font-medium mb-1">아직 남긴 이야기가 없어요</p>
              <p className="text-slate-500 text-sm mb-5">여행의 첫 점을 찍어보세요</p>
              <Link
                href="/story/new"
                className="inline-flex items-center gap-1.5 bg-[#1A1A1A] text-white px-5 py-2 rounded-full text-sm transition-all duration-500 ease-in-out hover:-translate-y-[3px] hover:bg-[#333] active:translate-y-0 active:scale-[0.96] active:duration-100"
              >
                <PenSquare size={14} />
                Write
              </Link>
            </div>
          )
        ) : (
          <MyStoryCardGrid
            stories={stories.map((story) => ({
              id: story.id,
              thumbnail: extractFirstImage(story.content),
              title: story.title,
              preview: extractTextPreview(story.content),
              createdAt: story.createdAt,
              tags: story.tags,
              likeCount: story._count.likes,
              isLiked: myLikedIds.has(story.id),
            }))}
          />
        )}
      </ViewTransition>
    </div>
  );
}
