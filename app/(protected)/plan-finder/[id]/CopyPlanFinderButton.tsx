'use client';
import { useTransition } from 'react';
import { copyPublicPlanAction } from './actions';

// 0515: variant='bar' — 모바일 하단 고정 바용 전폭 채움 버튼(시안 4d). 기본은 기존 인라인 그대로.
export function CopyPlanFinderButton({ planId, variant }: { planId: string; variant?: 'bar' }) {
  const [isPending, startTransition] = useTransition();

  const handleCopy = () => {
    startTransition(async () => {
      const result = await copyPublicPlanAction(planId);
      if (result?.error) alert(result.error);
    });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={isPending}
      className={
        variant === 'bar'
          // 0524: 흰 글자는 primary(#4d9eff) 면에서 대비 2.74:1로 WCAG AA(4.5) 미달.
          // primary-fg(#0b1a2b) = 6.39:1. primary가 모드 공용 토큰이라 결함도 모드 무관 → 양쪽 적용.
          ? 'w-full py-[14px] rounded-lg bg-primary text-primary-fg text-[15px] font-bold disabled:opacity-50'
          : 'px-4 py-1.5 rounded-full text-sm border border-border text-fg2 hover:bg-surface2 transition-colors disabled:opacity-50'
      }
    >
      {isPending ? '담는 중...' : '내 여행으로 담기'}
    </button>
  );
}
