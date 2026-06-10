import { ViewTransition } from 'react';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { extractFirstImage, extractTextPreview } from '@/lib/story/extract-thumbnail';
import { fetchStoriesWithMeta } from '@/lib/story/queries';
import { TagSearchBar } from './_components/TagSearchBar';
import { StoryCard } from './_components/StoryCard';

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Story</h1>
        <TagSearchBar q={keyword} basePath="/story" />
      </div>
      <ViewTransition key={listKey} default="list-fade">
      {stories.length === 0 ? (
        <div className="glass-outer p-12 text-center text-slate-500">
          {keyword ? `"${keyword}" 태그가 포함된 스토리가 없습니다` : '아직 작성된 글이 없습니다'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {stories.map((story) => (
            <StoryCard
              key={story.id}
              id={story.id}
              thumbnail={extractFirstImage(story.content)}
              title={story.title}
              preview={extractTextPreview(story.content)}
              createdAt={story.createdAt}
              tags={story.tags}
              likeCount={story._count.likes}
              isLiked={myLikedIds.has(story.id)}
              author={story.user.email}
            />
          ))}
        </div>
      )}
      </ViewTransition>
    </div>
  );
}
