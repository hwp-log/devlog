'use client';
import { useTransition, useOptimistic } from 'react';
import Link from 'next/link';
import { PencilLine, Trash2 } from 'lucide-react';
import { togglePlanPublicAction } from './actions';
import { deleteMyPlanAction } from '../actions';
import { BTN_ICON_CHIP } from '@/lib/button-styles';

// 0559: 소유자 관리 버튼군 — PlanDetail 인라인(0555)에서 무변 추출, 공개 상세(PlanFinderDetail)와
//   공용. 두 벌 관리 방지(0556 PlanItemRow 공용화와 같은 이유 — 이쪽은 소유자 상세가 정본).
//   공개 전환만 pill — 상태 표시를 겸하는 토글이라 아이콘으론 현재 상태가 안 읽힘.
//   수정·삭제는 아이콘 칩(스토리 상세 DeleteButton과 동일 재질).
//   삭제 후 이동은 deleteMyPlanAction 내부 redirect('/my-plan') — 두 화면 공통(삭제된 플랜
//   상세는 어차피 404, 삭제 = 내 플랜 관리 행위).

interface Props {
  planId: string;
  isPublic: boolean;
}

export function PlanOwnerActions({ planId, isPublic }: Props) {
  const [isPending, startTransition] = useTransition();
  const [isPendingPublic, startPublicTransition] = useTransition();
  const [optimisticPublic, setOptimisticPublic] = useOptimistic(
    isPublic,
    (_, next: boolean) => next,
  );

  const handleTogglePublic = () => {
    const next = !optimisticPublic;
    startPublicTransition(async () => {
      setOptimisticPublic(next);
      await togglePlanPublicAction(planId, next);
    });
  };

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={handleTogglePublic}
        disabled={isPendingPublic}
        className={`px-4 py-1.5 rounded-full text-sm transition-colors disabled:opacity-50 ${
          optimisticPublic
            ? 'bg-fg text-bg'
            : 'border border-border text-fg2 hover:bg-surface2'
        }`}
      >
        {optimisticPublic ? '공개 중' : '비공개'}
      </button>
      <Link
        href={`/my-plan/${planId}/edit`}
        aria-label="수정"
        className={`${BTN_ICON_CHIP} text-fg2 hover:text-fg`}
      >
        <PencilLine size={18} />
      </Link>
      <button
        type="button"
        onClick={() => {
          if (!confirm('계획을 삭제하시겠습니까?')) return;
          startTransition(() => deleteMyPlanAction(planId));
        }}
        disabled={isPending}
        aria-label="삭제"
        className={`${BTN_ICON_CHIP} text-fg2 hover:text-danger disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}

// 0566: PlanOwnerNotice("비공개로 두면 나만 볼 수 있습니다") 폐기 — 컴포넌트·호출부 통째.
//   상태는 바로 위 공개/비공개 토글 버튼이 이미 말하고, 이 문구는 0492(금액 공개)·0558(band
//   폐기)로 한 번 사실이 아니게 돼 0559에 갈아끼운 이력이 있다 — 규칙이 바뀌면 썩는다는 실례
//   자체가 제거 논거였다. 빈 컴포넌트로 남기지 않은 이유: 화석이 된다.
