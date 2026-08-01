'use client';
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { computePosition, autoUpdate, offset, flip, shift } from '@floating-ui/dom';
import {
  Ellipsis, ArrowLeft, Heading3, AArrowDown, Quote,
  Lightbulb, MessageCircleQuestion, TriangleAlert,
  Strikethrough, Code, Link as LinkIcon, LayoutTemplate,
  type LucideIcon,
} from 'lucide-react';
import { FormatMenuContent } from './FormatMenu';

// 모바일 툴바 "더보기" 팝오버(0461, progressive disclosure) — 한 줄에서 접은 항목의 진입점.
// 특히 H3·취소선·인라인 코드는 슬래시·버블 어디에도 없어 이 패널이 유일한 진입점.
// 메커니즘(floating-ui fixed + autoUpdate, 바깥클릭 닫기, ESC·화살표 순회, aria-menu)과
// 셸 어휘는 FormatMenu 선례 복제. 서식은 같은 셸에서 FormatMenuContent로 내용 전환(0359 패턴).

// 활성 표시는 TiptapEditor의 useEditorState 맵을 prop으로 공유(단일 소스 — 툴바·버블과 동일)
type ActiveMap = {
  heading3: boolean;
  size: boolean;
  blockquote: boolean;
  calloutTip: boolean;
  calloutFaq: boolean;
  calloutWarn: boolean;
  strike: boolean;
  code: boolean;
  link: boolean;
} | null;

interface ToolbarMoreProps {
  editor: Editor;
  active: ActiveMap;
  onLink: () => void; // TiptapEditor.handleLink 전달 — URL prompt 로직 중복 금지
  className?: string; // 부모 flex row에서의 표시·순서 제어(sm:hidden·order)
  // 0463: 패널 열림 상태를 부모(TiptapEditor)에 통지 — 슬래시 메뉴 억제·닫기 배선용
  onOpenChange?: (open: boolean) => void;
}

export function ToolbarMore({ editor, active, onLink, className = '', onOpenChange }: ToolbarMoreProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'list' | 'format'>('list');
  const [activeIndex, setActiveIndex] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // 접힘 항목 목록 — 데스크톱 툴바의 라벨·아이콘·체인과 1:1 동일(어휘 일치)
  const items: { label: string; icon: LucideIcon; isActive: boolean; run: () => void }[] = [
    { label: '소제목', icon: Heading3, isActive: !!active?.heading3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: '작게', icon: AArrowDown, isActive: !!active?.size, run: () => editor.chain().focus().toggleSmall().run() },
    { label: '인용', icon: Quote, isActive: !!active?.blockquote, run: () => editor.chain().focus().toggleBlockquote().run() },
    { label: '취소선', icon: Strikethrough, isActive: !!active?.strike, run: () => editor.chain().focus().toggleStrike().run() },
    { label: '인라인 코드', icon: Code, isActive: !!active?.code, run: () => editor.chain().focus().toggleCode().run() },
    { label: '링크', icon: LinkIcon, isActive: !!active?.link, run: onLink },
    { label: '팁 콜아웃', icon: Lightbulb, isActive: !!active?.calloutTip, run: () => editor.chain().focus().insertCallout('tip').run() },
    { label: 'FAQ 콜아웃', icon: MessageCircleQuestion, isActive: !!active?.calloutFaq, run: () => editor.chain().focus().insertCallout('faq').run() },
    { label: '주의 콜아웃', icon: TriangleAlert, isActive: !!active?.calloutWarn, run: () => editor.chain().focus().insertCallout('warn').run() },
  ];

  // 위치 계산 — FormatMenu와 동일(열릴 때만, autoUpdate가 스크롤·리사이즈 재계산)
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

  // 목록 뷰 진입 시 첫 항목 포커스(키보드 진입) — 서식 뷰 포커스는 FormatMenuContent가 담당
  useEffect(() => {
    if (open && view === 'list') itemRefs.current[0]?.focus();
  }, [open, view]);

  // 열림 상태 통지(0463) — 클린업 경유라 닫힘뿐 아니라 언마운트(버블 숨김)에도 false가 보장됨.
  // 버블 안 인스턴스가 열린 채 사라져도 슬래시 억제 플래그가 남지 않는다(스테일 방지).
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
    setView('list'); // 열 때 항상 목록부터
    setActiveIndex(0);
    setOpen((o) => !o);
  }

  function closeAll() {
    setOpen(false);
  }

  function runItem(item: (typeof items)[number]) {
    item.run();
    closeAll();
  }

  // 화살표 = 선형 순회(2열 그리드지만 FormatMenu 수준의 선형 이동 — plan 확정 범위)
  function onListKeyDown(e: React.KeyboardEvent) {
    const count = items.length + 1; // +1 = 서식 항목
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const n = (activeIndex + 1) % count;
      setActiveIndex(n);
      itemRefs.current[n]?.focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const n = (activeIndex - 1 + count) % count;
      setActiveIndex(n);
      itemRefs.current[n]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }
  }

  return (
    <div className={className}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="더보기"
        title="더보기"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="toolbar-more-menu"
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggle}
        // sm 리셋(0463) — 버블(데스크톱에도 표시)에서 다른 ToolbarButton과 같은 28px 정합.
        // 툴바 쪽 사용처는 sm:hidden 래퍼라 무영향
        className={`inline-flex items-center justify-center px-2 py-1 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 rounded text-sm font-medium transition-colors ${
          open ? 'bg-surface2 text-fg' : 'text-fg2 hover:bg-popover'
        }`}
      >
        <Ellipsis size={16} />
      </button>
      {open && (
        <div
          ref={popRef}
          id="toolbar-more-menu"
          style={{ position: 'fixed', top: 0, left: 0, zIndex: 50 }}
          className="min-w-[240px] rounded-[10px] border-[0.5px] border-border bg-card p-1 shadow-lg"
        >
          {view === 'list' ? (
            <div role="menu" aria-label="더보기" onKeyDown={onListKeyDown} className="grid grid-cols-2 gap-1">
              {items.map((item, i) => (
                <button
                  key={item.label}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={i === activeIndex ? 0 : -1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => runItem(item)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex items-center gap-2 min-h-[44px] rounded px-2 text-left text-sm font-medium transition-colors ${
                    item.isActive ? 'bg-surface2 text-fg' : 'text-fg2 hover:bg-popover'
                  }`}
                >
                  <item.icon size={16} className="shrink-0" />
                  {item.label}
                </button>
              ))}
              {/* 서식 — 같은 셸에서 FormatMenuContent로 내용 전환(0359). 파괴적 확인 화면도 그 안에서 */}
              <button
                ref={(el) => {
                  itemRefs.current[items.length] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={items.length === activeIndex ? 0 : -1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setView('format')}
                onMouseEnter={() => setActiveIndex(items.length)}
                className="flex items-center gap-2 min-h-[44px] rounded px-2 text-left text-sm font-medium text-fg2 hover:bg-popover transition-colors"
              >
                <LayoutTemplate size={16} className="shrink-0" />
                서식
              </button>
            </div>
          ) : (
            <div>
              {/* 모바일엔 ESC가 없어 터치용 뒤로가 필수 — 목록 뷰 복귀 */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setView('list')}
                className="flex w-full items-center gap-1.5 min-h-[44px] rounded px-2 text-sm text-fg2 hover:bg-popover transition-colors"
              >
                <ArrowLeft size={14} />
                뒤로
              </button>
              <FormatMenuContent
                editor={editor}
                onDone={closeAll}
                onEscape={() => setView('list')}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
