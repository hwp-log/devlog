import { ViewTransition } from 'react';
import { extractFirstImage } from '@/lib/story/extract-thumbnail';
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
  const keyword = q?.trim() ?? '';
  const stories = await fetchStoriesWithMeta({ tag: keyword || undefined });
  const popularTags = await fetchPopularTags();

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
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-fg2">
          {keyword ? `"${keyword}" 태그가 포함된 스토리가 없습니다` : '아직 작성된 글이 없습니다'}
        </div>
      ) : (
        <StoryCardList
          stories={stories.map((story) => {
            const spot = story.storySpots[0]?.spot;
            return {
              id: story.id,
              thumbnail: extractFirstImage(story.content),
              title: story.title,
              createdAt: story.createdAt,
              likeCount: story._count.likes,
              work: spot?.spotMovies[0]?.movie.title ?? null,
              location: spot?.name ?? null,
            };
          })}
        />
      )}
      </ViewTransition>
    </div>
  );
}
