'use client';
import { useTransition } from 'react';

interface Props {
  planId: string;
  action: (planId: string) => Promise<void>;
}

export function DeletePlanButton({ planId, action }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm('계획을 삭제하시겠습니까?')) return;
    startTransition(() => action(planId));
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="w-7 h-7 flex items-center justify-center rounded-full bg-white/80 border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors disabled:opacity-40"
      aria-label="계획 삭제"
    >
      ×
    </button>
  );
}
