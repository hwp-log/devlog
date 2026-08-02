'use client';
import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { BTN_ICON_CHIP } from '@/lib/button-styles';
import { deleteStoryAction } from './actions';

export function DeleteButton({ storyId }: { storyId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    startTransition(() => { deleteStoryAction(storyId); });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      aria-label="삭제"
      // 칩 아이콘(0481 최종) — surface2 면 위 정지 무채(fg2), 위험 신호는 hover:text-danger로
      // 의도 접근 시점에만(0477 토큰). 콜아웃과 같은 면 = 재질 정합
      className={`${BTN_ICON_CHIP} text-fg2 hover:text-danger disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <Trash2 size={18} />
    </button>
  );
}
