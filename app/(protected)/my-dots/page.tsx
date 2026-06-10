import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { extractFirstImage, extractTextPreview } from '@/lib/story/extract-thumbnail';
import { fetchStoriesWithMeta } from '@/lib/story/queries';
import { StoryCard } from '@/app/story/_components/StoryCard';
import { TagSearchBar } from '@/app/story/_components/TagSearchBar';

export default async function MyDotsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { q } = await searchParams;
  const keyword = q?.trim() ?? '';

  const stories = await fetchStoriesWithMeta({ userId: user!.id, tag: keyword || undefined });

  const myLikedIds = new Set<string>();
  if (stories.length > 0) {
    const myLikes = await prisma.like.findMany({
      where: { userId: user!.id, storyId: { in: stories.map((s) => s.id) } },
      select: { storyId: true },
    });
    myLikes.forEach((l) => myLikedIds.add(l.storyId));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">MyStory</h1>
        <TagSearchBar q={keyword} basePath="/my-dots" />
      </div>

      {stories.length === 0 ? (
        <div className="glass-outer p-12 text-center">
          <p className="text-slate-500 mb-4">
            {keyword
              ? `"${keyword}" 태그가 포함된 스토리가 없습니다`
              : '아직 작성한 스토리가 없습니다.'}
          </p>
          {!keyword && (
            <Link
              href="/story/new"
              className="inline-block bg-[#1A1A1A] text-white px-5 py-2 rounded-full text-sm"
            >
              첫 스토리 작성하기
            </Link>
          )}
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
