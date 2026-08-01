'use client';
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { computePosition, autoUpdate, offset, flip, shift } from '@floating-ui/dom';
import {
  Ellipsis, ArrowLeft, AArrowDown, Strikethrough, Code, Link as LinkIcon,
  Heading2, Heading3, List, Quote,
  type LucideIcon,
} from 'lucide-react';

// 버블 ⋯ 전용 선택 도구 목록(0464) — 슬래시 메뉴와 같은 생김새의 세로 목록을 직접 렌더.
// 실제 Suggestion은 캐럿이 "/" 뒤에 있어야 떠서 선택이 풀리므로 발동 불가(사용자 확정) —
// 선택을 유지한 채(트리거·행 mousedown preventDefault, 실행은 chain().focus() 재적용)
// 고른 항목을 선택 텍스트에 적용/변환한다.
// 역할 구분: 버블 = 이미 있는 글의 변환만 — 텍스트 마크 4종 + 블록 변환 4종.
// 삽입(이미지)·전체 교체(서식)는 슬래시·툴바 소관, 콜아웃은 감싸기 동작 불확실로 제외.
// 셸·행·그룹 헤더 클래스는 SlashCommand의 SlashMenu와 동일 문자열 복제 —
// 슬래시 UI 무접촉 제약(0464)으로 추출 대신 복제, 공용 추출은 후속 정리(0341 눈썹 선례).

interface BubbleMoreProps {
  editor: Editor;
  onLink: () => void; // TiptapEditor.handleLink — URL prompt 로직 중복 금지
  // 0463 억제 배선 그대로 수신 — 목록 열림 중 "/" 타이핑 억제·슬래시 열림 중 목록 열기 시 슬래시 닫기
  onOpenChange?: (open: boolean) => void;
}

type Item = { label: string; description: string; icon: LucideIcon; run: () => void };

export function BubbleMore({ editor, onLink, onOpenChange }: BubbleMoreProps) {
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // 그룹 헤더를 두는 이유(사용자 확정): 텍스트 마크는 고른 구간에만 걸리고,
  // 블록 변환은 선택이 걸친 문단 전체가 바뀐다 — 적용 결과가 달라 구분 표기.
  // 라벨·설명·아이콘은 툴바·슬래시 기존 어휘 재사용.
  const groups: { header: string; items: Item[] }[] = [
    {
      header: '텍스트',
      items: [
        { label: '작게', description: '선택한 글자를 작게', icon: AArrowDown, run: () => editor.chain().focus().toggleSmall().run() },
        { label: '취소선', description: '가운데 줄 긋기', icon: Strikethrough, run: () => editor.chain().focus().toggleStrike().run() },
        { label: '인라인 코드', description: '코드 서식', icon: Code, run: () => editor.chain().focus().toggleCode().run() },
        { label: '링크', description: 'URL 연결', icon: LinkIcon, run: onLink },
      ],
    },
    {
      header: '블록으로 바꾸기',
      items: [
        { label: '제목', description: '섹션 제목(H2)', icon: Heading2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
        { label: '소제목', description: '소제목(H3)', icon: Heading3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
        { label: '목록', description: '글머리 기호·번호', icon: List, run: () => editor.chain().focus().toggleBulletList().run() },
        { label: '인용', description: '왼쪽 선 강조', icon: Quote, run: () => editor.chain().focus().toggleBlockquote().run() },
      ],
    },
  ];
  const flatItems = groups.flatMap((g) => g.items);

  // 위치 계산 — FormatMenu·ToolbarMore와 동일(열릴 때만, autoUpdate 재계산)
  useEffect(() => {
    if (!open) return;
    const btn = buttonRef.current;
    const pop = popRef.current;
    if (!btn || !pop) return;
    return autoUpdate(btn, pop, () => {
      computePosition(btn, pop, {
        strategy: 'fixed',
        placement: 'bottom-end',
        middleware: [offset(8), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        Object.assign(pop.style, { left: `${x}px`, top: `${y}px` });
      });
    });
  }, [open]);

  // 열림 시 첫 항목 포커스(키보드 진입) — 프로그래매틱 focus는 PM 상태 선택 비파괴(0464 조사)
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  // 내부 스크롤에서 키보드 이동 시 선택 항목 가시화 — SlashMenu와 동일(nearest = 보이면 no-op)
  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // 열림 상태 통지 — ToolbarMore와 동일(클린업 경유라 닫힘·언마운트(버블 숨김) 모두 false 보장)
  useEffect(() => {
    if (!open) return;
    onOpenChange?.(true);
    return () => onOpenChange?.(false);
  }, [open, onOpenChange]);

  // 바깥 클릭 닫기 — FormatMenu와 동일(모달 아님)
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function toggle() {
    setSelectedIndex(0);
    setOpen((o) => !o);
  }

  function runItem(item: Item) {
    item.run();
    setOpen(false);
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const count = flatItems.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const n = (selectedIndex + 1) % count;
      setSelectedIndex(n);
      itemRefs.current[n]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const n = (selectedIndex - 1 + count) % count;
      setSelectedIndex(n);
      itemRefs.current[n]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  // 닫기 공용(뒤로·ESC) — 트리거 포커스 복귀는 rAF 한 프레임 지연(0464-b): 닫는 시점엔 버블이
  // 아직 invisible(상태 플러시 전)이라 visibility:hidden 요소는 포커스 불가 — 복귀 렌더 후 포커스
  // (FormatMenu backToList의 rAF 선례)
  function close() {
    setOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  }

  return (
    <div>
      <button
        ref={buttonRef}
        type="button"
        aria-label="더보기"
        title="더보기"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="bubble-more-menu"
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggle}
        className={`inline-flex items-center justify-center px-2 py-1 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 rounded text-sm font-medium transition-colors ${
          open ? 'bg-surface2 text-fg' : 'text-fg2 hover:bg-popover'
        }`}
      >
        <Ellipsis size={16} />
      </button>
      {open && (
        <div
          ref={popRef}
          id="bubble-more-menu"
          role="menu"
          aria-label="선택 도구"
          onKeyDown={onMenuKeyDown}
          // visibility:visible(0464-b) — 목록 열림 중 부모 버블이 invisible이 되는데,
          // visibility는 상속되지만 자손이 visible로 역전 가능(CSS 명세) — 목록만 살린다
          style={{ position: 'fixed', top: 0, left: 0, zIndex: 50, visibility: 'visible' }}
          // 셸 = SlashMenu와 동일 문자열(패딩만 아래 스크롤 영역으로 이동 — 뒤로 행은 스크롤 밖 고정)
          className="w-[250px] rounded-[12px] border border-border bg-card shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)]"
        >
          {/* 뒤로 — 모바일엔 ESC가 없어 터치용 닫기 행 필수(ToolbarMore 서식 뷰와 동일 스타일).
              스크롤 영역 밖 상단 고정이라 목록을 내려도 항상 보인다 */}
          <div className="px-1.5 pt-1.5">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={close}
              className="flex w-full items-center gap-1.5 min-h-[44px] rounded px-2 text-sm text-fg2 hover:bg-popover transition-colors"
            >
              <ArrowLeft size={14} />
              뒤로
            </button>
          </div>
          {/* 스크롤 영역 — max-h 208 = SlashCommand MOBILE_MAX_H와 동기(리터럴 복제, 한쪽만 바꾸면
              두 메뉴 높이가 어긋남). 상단 패딩 0 — sticky 헤더가 테두리에 밀착해 스크롤 항목을
              완전히 가리는 SlashMenu 구조 그대로. 8행 ≈ 52px씩이라 한 번에 ~3.5행 노출 + 스크롤 */}
          <div className="max-h-[208px] overflow-y-auto overscroll-none px-1.5 pb-1.5">
            {groups.map((group, gi) => {
              const base = gi === 0 ? 0 : groups[0].items.length;
              return (
                <div key={group.header}>
                  <div className="sticky top-0 bg-card px-[9px] pt-3 pb-1 text-[10px] tracking-[0.08em] text-muted">
                    {group.header}
                  </div>
                  {group.items.map((item, ii) => {
                    const i = base + ii;
                    return (
                      <button
                        key={item.label}
                        ref={(el) => {
                          itemRefs.current[i] = el;
                        }}
                        type="button"
                        role="menuitem"
                        tabIndex={i === selectedIndex ? 0 : -1}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => runItem(item)}
                        onMouseEnter={() => setSelectedIndex(i)}
                        // hover 클래스 없음 — onMouseEnter가 selectedIndex를 옮겨 hover=선택=surface2 단일 상태 언어(SlashMenu 규칙)
                        className={`flex w-full items-center gap-2.5 rounded-lg px-[9px] py-2 text-left transition-colors ${
                          i === selectedIndex ? 'bg-surface2' : ''
                        }`}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border-[0.5px] border-border bg-surface2 text-muted">
                          <item.icon size={16} />
                        </span>
                        <span className="flex flex-col">
                          <span className="text-[13px] font-medium text-fg">{item.label}</span>
                          <span className="mt-px text-xs text-muted">{item.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
