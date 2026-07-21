'use client';
import { useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { StoryHeader } from './StoryHeader';
import { TagSearchBar } from './TagSearchBar';
import { StoryListPaged, STORY_SEARCH_INPUT_ID } from './StoryListPaged';
import type { StoryCardProps } from './StoryCard';

interface Props {
  items: StoryCardProps[];
  page: number;
  totalPages: number;
  keyword: string;
  pageSize: number;
  popularTags: string[];
}

// 검색·페이지 넘김의 공용 클라 컨테이너 — useTransition 1개를 보유해 두 네비게이션이 같은 isPending을 공유.
// → 검색도 fetch "중" 스켈레톤(페이지 넘김과 동일 로딩 흐름). 서버 주도 데이터 경로·URL·페이지네이션 로직은 무변.
export function StoryBrowser({ items, page, totalPages, keyword, pageSize, popularTags }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const navigate = useCallback(
    (url: string) => startTransition(() => router.replace(url, { scroll: false })),
    [router],
  );

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <StoryHeader />
        <div className="appear-up w-full md:w-auto" style={{ animationDelay: '0.24s' }}>
          <TagSearchBar
            q={keyword}
            basePath="/story"
            tags={popularTags}
            inputId={STORY_SEARCH_INPUT_ID}
            onNavigate={navigate}
          />
        </div>
      </div>
      {items.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-fg2">
          {keyword ? `"${keyword}" 태그가 포함된 스토리가 없습니다` : '아직 작성된 글이 없습니다'}
        </div>
      ) : (
        <StoryListPaged
          items={items}
          page={page}
          totalPages={totalPages}
          keyword={keyword}
          pageSize={pageSize}
          isPending={isPending}
          navigate={navigate}
        />
      )}
    </div>
  );
}
