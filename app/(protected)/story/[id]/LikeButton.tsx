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
      // 알약화(0372 시안): border 알약 + 13px muted + 숫자 모노. 하트 활성 색은 heart-active 토큰
      // (--color-heart-active 노출 확인 — rose 하드코딩 대체), 동작(낙관 토글)은 무접촉
      className="flex items-center gap-1.5 rounded-full border border-border px-[14px] py-[6px] text-[13px] text-muted transition-colors hover:bg-popover"
    >
      <Heart
        size={14}
        className={optimistic.liked ? 'fill-heart-active text-heart-active' : 'text-muted'}
      />
      <span className="font-mono">{optimistic.count}</span>
    </button>
  );
}
