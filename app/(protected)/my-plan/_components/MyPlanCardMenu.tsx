'use client';
import { useState, useRef, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { MoreHorizontal, PencilLine, Globe, Lock, Trash2 } from 'lucide-react';
import { CARD_PILL_CLASS } from '@/lib/card-tokens';
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
 */
export function MyPlanCardMenu({ planId, title, isPublic }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const itemClass =
    'flex items-center gap-2.5 w-full min-h-11 px-2.5 rounded-md text-left text-sm font-medium text-fg2 hover:bg-surface2 hover:text-fg transition-colors disabled:opacity-50';

  return (
    <div ref={ref} className="absolute right-3 top-[13px] z-20 sm:top-[14px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${title} 메뉴`}
        aria-haspopup="menu"
        aria-expanded={open}
        // 터치 영역 44px = 시각 32px + after로 6px씩 확장(§5). 데스크톱은 호버·포커스·열림에만 노출,
        // 모바일은 호버가 없으므로 상시(sm 미만 opacity-100).
        className={`relative flex h-8 w-8 items-center justify-center rounded-full after:absolute after:-inset-1.5 after:content-[''] sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 transition-opacity ${
          open ? 'sm:opacity-100' : ''
        } ${CARD_PILL_CLASS}`}
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] w-[172px] rounded-lg border border-border bg-popover p-1 shadow-lg"
        >
          <Link href={`/my-plan/${planId}/edit`} role="menuitem" className={itemClass}>
            <PencilLine size={15} className="opacity-75" />
            편집
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled={isPending}
            onClick={() => {
              setOpen(false);
              startTransition(() => togglePlanPublicAction(planId, !isPublic));
            }}
            className={itemClass}
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
              setOpen(false);
              startTransition(() => deleteMyPlanAction(planId));
            }}
            className={`${itemClass} text-danger hover:text-danger`}
          >
            <Trash2 size={15} className="opacity-75" />
            삭제
          </button>
        </div>
      )}
    </div>
  );
}
