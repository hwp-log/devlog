'use client';

import { useState, useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { toggleLikeAction } from './actions';

type Props = {
  storyId: string;
  initialLiked: boolean;
  initialCount: number;
  isLoggedIn: boolean;
};

export function LikeButton({ storyId, initialLiked, initialCount, isLoggedIn }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [committed, setCommitted] = useState({ liked: initialLiked, count: initialCount });
  const [optimistic, addOptimistic] = useOptimistic(
    committed,
    (_, next: { liked: boolean; count: number }) => next,
  );

  const handleClick = () => {
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }
    const next = {
      liked: !committed.liked,
      count: committed.liked ? committed.count - 1 : committed.count + 1,
    };
    startTransition(async () => {
      addOptimistic(next);
      try {
        const result = await toggleLikeAction(storyId);
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
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-rose-50"
    >
      <Heart
        size={16}
        className={optimistic.liked ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}
      />
      <span className="text-slate-600">{optimistic.count}</span>
    </button>
  );
}
