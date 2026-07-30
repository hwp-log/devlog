import { StoryCard, type StoryCardProps } from './StoryCard';

// 높이·등장은 StoryListPaged의 스켈레톤 크로스페이드가 담당 → appear-up(CardReveal)·placeholder 제거.
// 카드는 절대 오버레이로 렌더(스테이지 높이는 스켈레톤 레이어가 고정).
export function StoryCardList({ stories }: { stories: StoryCardProps[] }) {
  return (
    // 0425: 열 수를 12(STORY_PAGE_SIZE)의 약수로 제한 — 마지막 줄이 비는 문제 해결.
    // 0448: 모바일 base 2→1열 — 플랜파인더(모바일 1열)와 인상 통일 + 카드 확대. 1·3·4·6 모두 12의 약수 유지.
    // StorySkeletonGrid와 클래스 동일 유지 필수(한쪽만 바꾸면 크로스페이드 시 레이아웃 시프트).
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-6">
      {stories.map((story) => (
        <StoryCard key={story.id} {...story} />
      ))}
    </div>
  );
}
