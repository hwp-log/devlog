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
      // 텍스트 링크화(0372) — 평상시 muted, hover는 fg2: danger 계열 토큰 부재(heartActive는
      // 하트 전용 주석이라 오용 금지, 새 토큰 추가 금지)로 위험 색 신호는 별도 판단 대기
      className="text-[13px] font-medium text-muted hover:text-fg2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {isPending ? '삭제 중...' : '삭제'}
    </button>
  );
}
