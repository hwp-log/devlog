'use client';
import { useTransition } from 'react';
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
      className="px-4 py-1.5 rounded-full text-sm bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {isPending ? '삭제 중...' : '삭제'}
    </button>
  );
}
