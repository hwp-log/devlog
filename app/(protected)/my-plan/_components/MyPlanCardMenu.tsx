'use client';
import { useTransition } from 'react';
import Link from 'next/link';
import { PencilLine, Globe, Lock, Trash2 } from 'lucide-react';
import {
  CardOverflowMenu,
  MENU_ITEM_CLASS,
  MENU_DANGER_CLASS,
} from '@/app/(protected)/_components/CardOverflowMenu';
import { togglePlanPublicAction } from '../[id]/actions';
import { deleteMyPlanAction } from '../actions';

interface Props {
  planId: string;
  title: string;
  isPublic: boolean;
}

/**
 * 소유자 카드의 ⋯ 오버플로 메뉴 — 편집 / 공개 전환 / 삭제.
 * 소유자 그리드의 업계 표준(Drive·Photos·Notion·YouTube Studio) 자리인 우상단.
 * 삭제는 구분선 아래 danger + confirm 한 단계 — 그리드에서 파괴 행동이 한 번의 오터치 거리에 놓이지 않게.
 * 상세 화면의 삭제(PlanDetail)와 같은 confirm 문구·같은 액션을 쓴다.
 * 0547: 셸(버튼·열림·팝오버)은 CardOverflowMenu로 추출 — MyStory 카드 메뉴와 공유. 항목·행동 무변.
 */
export function MyPlanCardMenu({ planId, title, isPublic }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <CardOverflowMenu title={title}>
      {(close) => (
        <>
          <Link href={`/my-plan/${planId}/edit`} role="menuitem" className={MENU_ITEM_CLASS}>
            <PencilLine size={15} className="opacity-75" />
            편집
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled={isPending}
            onClick={() => {
              close();
              startTransition(() => togglePlanPublicAction(planId, !isPublic));
            }}
            className={MENU_ITEM_CLASS}
          >
            {isPublic ? <Lock size={15} className="opacity-75" /> : <Globe size={15} className="opacity-75" />}
            {isPublic ? '비공개로 전환' : '공개로 전환'}
          </button>

          <div className="my-1 mx-1.5 h-px bg-hairline" />

          <button
            type="button"
            role="menuitem"
            disabled={isPending}
            onClick={() => {
              if (!confirm('계획을 삭제하시겠습니까?')) return;
              close();
              startTransition(() => deleteMyPlanAction(planId));
            }}
            className={MENU_DANGER_CLASS}
          >
            <Trash2 size={15} className="opacity-75" />
            삭제
          </button>
        </>
      )}
    </CardOverflowMenu>
  );
}
