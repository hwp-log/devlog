import { StoryCard, type StoryCardProps } from './StoryCard';

// 높이·등장은 StoryListPaged의 스켈레톤 크로스페이드가 담당 → appear-up(CardReveal)·placeholder 제거.
// 카드는 절대 오버레이로 렌더(스테이지 높이는 스켈레톤 레이어가 고정).
export function StoryCardList({ stories }: { stories: StoryCardProps[] }) {
  return (
    // 0425: 열 수를 2·3·4·6(STORY_PAGE_SIZE 12의 약수)으로 제한 — xl:5열에서 마지막 줄이 비는 문제 해결.
    // StorySkeletonGrid와 클래스 동일 유지 필수(한쪽만 바꾸면 크로스페이드 시 레이아웃 시프트).
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-6">
      {stories.map((story) => (
        <StoryCard key={story.id} {...story} />
      ))}
    </div>
  );
}
