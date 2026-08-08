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
// 0574 후속: 구 PlanOwnerActions(pill+수정+삭제 한 덩어리) 폐기 → **두 조각으로 분리**.
//   모바일 소유자 메타 행이 2행이 되면서 pill(2행 왼쪽)과 아이콘(1행 오른쪽)이 **서로 다른
//   줄**에 놓이기 때문 — 한 덩어리로는 나눌 수 없다. 소비처는 PlanFinderDetail 하나뿐이라
//   합쳐진 형태를 남겨둘 이유가 없다(소비처 0 래퍼 = 화석).
//   상태는 조각별로 자기 것만 갖는다: 토글의 optimistic은 PlanPublicToggle,
//   삭제의 pending은 PlanManageIcons. **토글은 절대 두 번 렌더하지 않는다** — 같은 화면에
//   두 인스턴스가 있으면 optimistic 상태가 갈린다(아이콘 쪽은 렌더 후 이탈뿐이라 무해).

export function PlanPublicToggle({ planId, isPublic }: { planId: string; isPublic: boolean }) {
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
    <button
      type="button"
      onClick={handleTogglePublic}
      disabled={isPendingPublic}
      className={`shrink-0 px-4 py-1.5 rounded-full text-sm transition-colors disabled:opacity-50 ${
        optimisticPublic
          ? 'bg-fg text-bg'
          : 'border border-border text-fg2 hover:bg-surface2'
      }`}
    >
      {optimisticPublic ? '공개 중' : '비공개'}
    </button>
  );
}

// className: 호출부가 배치만 얹는다(모바일 1행 오른쪽 ml-auto / 데스크톱 우측 묶음).
//   조판을 prop으로 분기하지 않는 원칙(0518)과 어긋나지 않는다 — variant가 아니라
//   **위치 클래스 전달**이고, 내부 조판(gap-2·칩 크기)은 여기서 고정이다.
export function PlanManageIcons({ planId, className = '' }: { planId: string; className?: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className={`flex items-center gap-2 shrink-0 ${className}`}>
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
