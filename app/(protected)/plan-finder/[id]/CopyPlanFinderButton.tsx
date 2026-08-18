'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { copyPublicPlanAction } from './actions';

// 0515: variant='bar' — 모바일 하단 고정 바용 전폭 채움 버튼(시안 4d). 기본은 기존 인라인 그대로.
export function CopyPlanFinderButton({ planId, variant }: { planId: string; variant?: 'bar' }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // 0599: 이동은 여기가 담당한다 — 액션은 값만 돌려준다(actions.ts 상단 주석).
  //   push인 이유: 서버 액션의 redirect는 기본이 push라(Next 16) 뒤로가기 히스토리가
  //   기존과 같게 유지된다. startTransition 안이라 내비게이션이 끝날 때까지
  //   isPending이 유지돼 버튼 비활성·"담는 중..." 표시도 그대로다.
  const handleCopy = () => {
    startTransition(async () => {
      const result = await copyPublicPlanAction(planId);
      if ('planId' in result) router.push('/my-plan');
      else if ('unauthenticated' in result) router.push('/login');
      else alert(result.error);
    });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={isPending}
      className={
        variant === 'bar'
          // 0524: 흰 글자는 primary(#4d9eff) 면에서 대비 2.74:1로 WCAG AA(4.5) 미달이고
          // primary-fg(#0b1a2b)가 6.39:1이라 한때 primary-fg였다.
          // 0530: 그럼에도 primary 채움 버튼의 글자는 흰색으로 통일(사용자 확정, 0529 주요 버튼과 동일 선택) —
          // AA 미달을 알고 수용한다. 바꿀 땐 세 화면(작성 저장·MyPlan 새 계획·여기)을 함께.
          ? 'w-full py-[14px] rounded-lg bg-primary text-white text-[15px] font-bold disabled:opacity-50'
          : 'px-4 py-1.5 rounded-full text-sm border border-border text-fg2 hover:bg-surface2 transition-colors disabled:opacity-50'
      }
    >
      {isPending ? '담는 중...' : '내 여행으로 담기'}
    </button>
  );
}
