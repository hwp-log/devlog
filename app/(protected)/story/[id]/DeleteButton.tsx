'use client';
import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { BTN_ICON_GHOST } from '@/lib/button-styles';
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
      // 글리프 아이콘(0481 최종) — 개방 캔버스(0371) 정합으로 상자 제거, danger 색 글리프만.
      // 구 텍스트 링크(0372, 당시 danger 토큰 부재로 muted)의 색 문제는 0477 토큰으로 해소
      className={`${BTN_ICON_GHOST} text-danger disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <Trash2 size={18} />
    </button>
  );
}
