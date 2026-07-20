'use client';
import { useEffect, useRef } from 'react';
import { StoryCard, type StoryCardProps } from './StoryCard';
import { CardReveal } from './CardReveal';

type StoryItem = StoryCardProps;

export function StoryCardList({ stories }: { stories: StoryItem[] }) {
  const initialPhaseRef = useRef(true);
  useEffect(() => {
    const t = setTimeout(() => {
      initialPhaseRef.current = false;
    }, 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {stories.map((story, i) => (
        <CardReveal key={story.id} index={i} initialPhaseRef={initialPhaseRef}>
          <StoryCard {...story} />
        </CardReveal>
      ))}
    </div>
  );
}
