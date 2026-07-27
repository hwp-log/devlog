'use client';
import { useState, useOptimistic, useTransition } from 'react';
import { Heart } from 'lucide-react';
import { togglePlanLikeAction } from './actions';

type Props = { planId: string; initialLiked: boolean; initialCount: number };

export function PlanLikeButton({ planId, initialLiked, initialCount }: Props) {
  const [isPending, startTransition] = useTransition();
  const [committed, setCommitted] = useState({ liked: initialLiked, count: initialCount });
  const [optimistic, addOptimistic] = useOptimistic(
    committed,
    (_, next: { liked: boolean; count: number }) => next,
  );

  const handleClick = () => {
    const next = {
      liked: !committed.liked,
      count: committed.liked ? committed.count - 1 : committed.count + 1,
    };
    startTransition(async () => {
      addOptimistic(next);
      try {
        const result = await togglePlanLikeAction(planId);
        setCommitted(result);
      } catch {
        // useOptimistic 자동 롤백
      }
    });
  };

  return (
    <button
      onClick={handleClick}
      aria-label={optimistic.liked ? '좋아요 취소' : '좋아요'}
      disabled={isPending}
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-surface2"
    >
      <Heart
        size={16}
        className={optimistic.liked ? 'fill-heart-active text-heart-active' : 'text-muted'}
      />
      <span className="text-fg2">{optimistic.count}</span>
    </button>
  );
}
