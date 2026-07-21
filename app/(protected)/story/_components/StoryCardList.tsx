import { StoryCard, type StoryCardProps } from './StoryCard';

// 높이·등장은 StoryListPaged의 스켈레톤 크로스페이드가 담당 → appear-up(CardReveal)·placeholder 제거.
// 카드는 절대 오버레이로 렌더(스테이지 높이는 스켈레톤 레이어가 고정).
export function StoryCardList({ stories }: { stories: StoryCardProps[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
      {stories.map((story) => (
        <StoryCard key={story.id} {...story} />
      ))}
    </div>
  );
}
