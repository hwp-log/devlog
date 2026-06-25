'use client';
import { useEffect, useRef } from 'react';
import { StoryCard } from './StoryCard';
import { CardReveal } from './CardReveal';

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
  authorAvatarUrl?: string | null;
}

export function StoryCardList({ stories }: { stories: StoryItem[] }) {
  const initialPhaseRef = useRef(true);
  useEffect(() => {
    const t = setTimeout(() => {
      initialPhaseRef.current = false;
    }, 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {stories.map((story, i) => (
        <CardReveal key={story.id} index={i} initialPhaseRef={initialPhaseRef}>
          <StoryCard {...story} />
        </CardReveal>
      ))}
    </div>
  );
}
