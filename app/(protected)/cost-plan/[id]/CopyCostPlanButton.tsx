'use client';
import { useTransition } from 'react';
import { copyPublicPlanAction } from './actions';

export function CopyCostPlanButton({ planId }: { planId: string }) {
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
      className="px-4 py-1.5 rounded-full text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
    >
      {isPending ? '담는 중...' : '내 여행으로 담기'}
    </button>
  );
}
