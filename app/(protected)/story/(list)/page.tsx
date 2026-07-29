import { fetchStoryPage, fetchPopularTags, STORY_PAGE_SIZE } from '@/lib/story/queries';
import { StoryBrowser } from '../_components/StoryBrowser';

export default async function StoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const keyword = q?.trim() ?? '';
  const requestedPage = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);

  // 서버 주도 단일 데이터 경로 — URL(searchParams)이 소스. StoryBrowser의 공용 navigate(router.replace)가 이 RSC를 재요청.
  const [{ items, totalPages, page }, popularTags] = await Promise.all([
    fetchStoryPage({ keyword, page: requestedPage }),
    fetchPopularTags(),
  ]);

  return (
    <StoryBrowser
      items={items}
      page={page}
      totalPages={totalPages}
      keyword={keyword}
      pageSize={STORY_PAGE_SIZE}
      popularTags={popularTags}
    />
  );
}
