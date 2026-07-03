import { ViewTransition } from 'react';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { extractFirstImage, extractTextPreview } from '@/lib/story/extract-thumbnail';
import { fetchStoriesWithMeta, fetchPopularTags } from '@/lib/story/queries';
import { TagSearchBar } from './_components/TagSearchBar';
import { StoryHeader } from './_components/StoryHeader';
import { StoryCardList } from './_components/StoryCardList';

export default async function StoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const keyword = q?.trim() ?? '';
  const stories = await fetchStoriesWithMeta({ tag: keyword || undefined });
  const popularTags = await fetchPopularTags();

  const myLikedIds = new Set<string>();
  if (user) {
    const myLikes = await prisma.like.findMany({
      where: { userId: user.id, storyId: { in: stories.map((s) => s.id) } },
      select: { storyId: true },
    });
    myLikes.forEach((l) => myLikedIds.add(l.storyId));
  }

  const listKey = stories.map(s => s.id).join('-') || '__empty__';

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <StoryHeader />
        <div className="appear-up w-full md:w-auto" style={{ animationDelay: '0.24s' }}>
          <TagSearchBar q={keyword} basePath="/story" tags={popularTags} />
        </div>
      </div>
      <ViewTransition key={listKey} default="list-fade">
      {stories.length === 0 ? (
        <div className="glass-outer p-12 text-center text-slate-500">
          {keyword ? `"${keyword}" 태그가 포함된 스토리가 없습니다` : '아직 작성된 글이 없습니다'}
        </div>
      ) : (
        <StoryCardList
          stories={stories.map((story) => ({
            id: story.id,
            thumbnail: extractFirstImage(story.content),
            title: story.title,
            preview: extractTextPreview(story.content),
            createdAt: story.createdAt,
            tags: story.tags,
            likeCount: story._count.likes,
            isLiked: myLikedIds.has(story.id),
            authorNickname: story.user.nickname,
            authorAvatarUrl: story.user.avatarUrl,
          }))}
        />
      )}
      </ViewTransition>
    </div>
  );
}
