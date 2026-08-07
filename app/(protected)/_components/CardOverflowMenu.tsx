'use client';
import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { CARD_PILL_CLASS } from '@/lib/card-tokens';

/**
 * 0547: 소유자 카드 ⋯ 오버플로 메뉴 **셸** — MyPlanCardMenu(0530)에서 추출.
 * 버튼(노출·터치 타겟)·열림 상태·외부 클릭·ESC·팝오버 컨테이너만 담당, 항목은 children.
 * 소비처: MyPlanCardMenu(편집·공개 전환·삭제) / MyStoryCardMenu(편집·삭제).
 * 전제: 부모 카드가 `group relative`이고 카드 본체는 absolute Link(형제) — 메뉴는 z-20으로 위.
 */

// 위험 항목은 hover 글자색이 달라야 해서 클래스를 통째로 가른다 —
// 한 문자열에 hover:text-fg와 hover:text-danger를 겹치면 어느 쪽이 이길지 Tailwind 출력 순서에 달린다(0462 교훈).
const ITEM_BASE =
  'flex items-center gap-2.5 w-full min-h-11 px-2.5 rounded-md text-left text-sm font-medium transition-colors disabled:opacity-50 hover:bg-surface2';
export const MENU_ITEM_CLASS = `${ITEM_BASE} text-fg2 hover:text-fg`;
export const MENU_DANGER_CLASS = `${ITEM_BASE} text-danger`;

interface Props {
  /** aria-label용 카드 제목 */
  title: string;
  /** 메뉴 항목들 (role="menuitem" — MENU_ITEM_CLASS/MENU_DANGER_CLASS 사용).
   * render-prop: 닫힘 시점은 항목 책임(예: confirm 취소 시 열림 유지) — close를 넘겨준다. */
  children: (close: () => void) => React.ReactNode;
  /** 카드 우상단 앵커 — 기본은 MyPlanCard 상단바 인셋(13/14px)과 짝.
   * StoryCard는 칩 인셋이 inset-x-2 top-2(8px)라 'right-2 top-2'를 전달(칩과 정렬). */
  positionClass?: string;
}

export function CardOverflowMenu({ title, children, positionClass = 'right-3 top-[13px] sm:top-[14px]' }: Props) {
  const [open, setOpen] = useState(false);
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

  return (
    <div ref={ref} className={`absolute z-20 ${positionClass}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${title} 메뉴`}
        aria-haspopup="menu"
        aria-expanded={open}
        data-open={open}
        // 터치 영역 44px = 시각 32px + after로 6px씩 확장(§5). 데스크톱은 호버·포커스·열림에만 노출,
        // 모바일은 호버가 없으므로 상시(sm 미만 opacity-100).
        // 열림 상태는 data-[open=true](속성 선택자 = 특이도 한 단 위)로 잡는다 —
        // sm:opacity-100과 sm:opacity-0은 특이도가 같아 어느 쪽이 이길지 출력 순서에 달리기 때문.
        className={`relative flex h-8 w-8 items-center justify-center rounded-full after:absolute after:-inset-1.5 after:content-[''] transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 data-[open=true]:opacity-100 ${CARD_PILL_CLASS}`}
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div
          role="menu"
          // MyPlan 카드 루트가 overflow-hidden이라 메뉴는 카드 안에 들어와야 안 잘린다 —
          // 172px×약 145px은 카드(240/280px) 안에 들어옴(항목을 늘리면 이 여유부터 확인할 것).
          className="absolute right-0 top-[calc(100%+8px)] w-[172px] rounded-lg border border-border bg-popover p-1 shadow-lg"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
