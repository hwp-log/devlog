'use client';
import { useEffect, useRef } from 'react';
import { StoryCard } from './StoryCard';

interface StoryItem {
  id: string;
  thumbnail: string | null;
  title: string;
  preview: string;
  createdAt: Date;
  tags: { id: string; name: string }[];
  likeCount: number;
  isLiked: boolean;
  authorNickname?: string;
}

export function StoryCardList({ stories }: { stories: StoryItem[] }) {
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    isFirstRenderRef.current = false;
  }, []);
  const isFirst = isFirstRenderRef.current;
  const baseDelay = 0.36;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {stories.map((story, i) => {
        const delay = baseDelay + (i < 9 ? i * 0.12 : 1.08);
        return (
          <div
            key={story.id}
            className={isFirst ? 'appear-up' : undefined}
            style={isFirst ? { animationDelay: `${delay}s` } : undefined}
          >
            <StoryCard {...story} />
          </div>
        );
      })}
    </div>
  );
}
