import { createClient } from '@/lib/supabase/server';
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

  // 뷰어 id — 내가 누른 좋아요(빨강 하트) 판정용. plan-finder page와 동일 원리.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 서버 주도 단일 데이터 경로 — URL(searchParams)이 소스. StoryBrowser의 공용 navigate(router.replace)가 이 RSC를 재요청.
  const [{ items, totalPages, page }, popularTags] = await Promise.all([
    fetchStoryPage({ keyword, page: requestedPage, viewerId: user?.id }),
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
