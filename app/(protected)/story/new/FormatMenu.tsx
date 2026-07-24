'use client';
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { computePosition, autoUpdate, offset, flip, shift } from '@floating-ui/dom';
import { LayoutTemplate } from 'lucide-react';
import { STORY_FORMS, formSkeletonHtml, sectionsToInsert } from '@/lib/story/template';
import { classifyDocSections } from '@/lib/story/empty-sections-doc';

// 툴바 우측 끝 "서식" 버튼 + 팝오버. 양식 3종(촬영지 기록·코스 기록·자유) 중 하나를 고르면
// 본문 양식이 그것으로 바뀐다. "삽입·보충"이 아니라 "양식 교체" — 빈 섹션은 걷어내고 새 양식을 넣되
// 쓴 내용은 삭제하지 않는다. 표준(네이버·티스토리)도 템플릿을 통째로 불러오는 방식.
// 팝오버는 React 트리 안에 인라인 렌더 — Pretendard가 상속으로 보존됨(0326 body-mount 문제 회피).
// 위치만 @floating-ui/dom(strategy 'fixed', 0325 SlashCommand와 동일 — transform 조상 무관).
export function FormatMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  // 팝오버 열 때 읽은 "내용 있어 살아남는 섹션 수" 스냅샷 — 각주 표시용(열려 있는 동안 본문 불변)
  const [survivorCount, setSurvivorCount] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // 위치 계산 — 열릴 때만. autoUpdate가 스크롤·리사이즈 시 재계산 후 cleanup.
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

  // 열릴 때 첫 항목으로 포커스(키보드 진입). 활성 인덱스 리셋은 토글 핸들러에서 —
  // 이펙트 내 setState는 연쇄 렌더 유발이라 지양(react-hooks/set-state-in-effect).
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  function toggle() {
    if (!open) {
      // 열 때 살아남는 섹션 수 스냅샷 — 각주는 표시, 실제 교체는 클릭 때 같은 함수로 재판정(어긋남 방지)
      const { survivingHeadings } = classifyDocSections(editor.state.doc);
      setSurvivorCount(survivingHeadings.size);
    }
    setActiveIndex(0); // 다음에 열 때 항상 첫 항목부터(닫힘 시엔 무의미, 무해)
    setOpen((o) => !o);
  }

  // 바깥 클릭 닫기 — 버튼·팝오버 밖 pointerdown이면 닫음(모달 아님)
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

  // 양식 교체 — 사용자가 쓴 내용은 어떤 경우에도 삭제하지 않는다.
  function applyForm(form: (typeof STORY_FORMS)[number]) {
    // 표시(각주)와 같은 classify — 살아남는 섹션 + 빈 구간 삭제 위치 + 내용 유무를 현재 doc에서 재판정
    const { survivingHeadings, emptyRanges, hasContent } = classifyDocSections(editor.state.doc);
    // 살아남는 섹션과 heading이 겹치는 것은 제외하고 삽입할 섹션만
    const html = formSkeletonHtml(sectionsToInsert(form.sections, survivingHeadings));

    if (!hasContent && form.sections.length > 0) {
      // 내용이 하나도 없을 때만 전체 교체(빈 스켈레톤 포함) — 지울 사용자 내용이 없어 비파괴.
      // 도입부가 첫 섹션(heading)으로 승격돼 앞 빈 문단은 불필요(두면 placeholder 없는 빈 줄만 남음).
      // setContent는 emitUpdate 기본 true라 hidden input 동기됨.
      editor.chain().focus().setContent(formSkeletonHtml(form.sections)).run();
    } else {
      // v1 절충: survivor가 있으면 새 섹션이 문서 끝에 append되어 양식 순서와 어긋날 수 있음
      //   (예: 근처 볼거리만 써둔 뒤 촬영지 기록 선택 → 근처 볼거리 다음에 분위기·촬영지 정보).
      //   양식 위치로 재배치하려면 survivor 재구성 + setContent가 필요한데 "빈 경우만 setContent"
      //   제약과 충돌 → 순서 재배치는 v1.1로 이관. v1은 비파괴를 우선한다.
      // 끝에 먼저 append(앞쪽 위치 불변) → 빈 구간을 뒤에서 앞으로 삭제(위치 안전). 단일 트랜잭션.
      let c = editor.chain().focus();
      if (html) c = c.insertContentAt(editor.state.doc.content.size, html);
      for (const r of [...emptyRanges].reverse()) c = c.deleteRange(r);
      c.run();
    }
    setOpen(false);
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const count = STORY_FORMS.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const n = (activeIndex + 1) % count;
      setActiveIndex(n);
      itemRefs.current[n]?.focus();
    } else if (e.key === 'ArrowUp') {
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
    <div className="ml-auto">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="format-menu"
        // mousedown preventDefault — 에디터 선택/포커스 유지(다른 툴바 버튼 관례와 동일)
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggle}
        className={`flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors ${
          open ? 'bg-surface2 text-fg' : 'text-fg2 hover:bg-popover'
        }`}
      >
        <LayoutTemplate size={16} />
        서식
      </button>
      {open && (
        <div
          ref={popRef}
          id="format-menu"
          role="menu"
          aria-label="본문 양식"
          onKeyDown={onMenuKeyDown}
          style={{ position: 'fixed', top: 0, left: 0, zIndex: 50 }}
          className="min-w-[240px] rounded-[10px] border-[0.5px] border-border bg-card p-1 shadow-lg"
        >
          {STORY_FORMS.map((form, i) => (
            <button
              key={form.key}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={i === activeIndex ? 0 : -1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyForm(form)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`w-full rounded px-2 py-1.5 text-left transition-colors ${
                i === activeIndex ? 'bg-surface2' : 'hover:bg-popover'
              }`}
            >
              <span className="block text-sm font-medium text-fg">{form.name}</span>
              <span className="block text-xs text-muted">{form.description}</span>
            </button>
          ))}
          {survivorCount > 0 && (
            <p role="note" className="px-2 pt-1.5 pb-1 text-xs text-muted border-t border-border mt-1">
              내용이 있는 {survivorCount}개 섹션은 지우지 않아요
            </p>
          )}
        </div>
      )}
    </div>
  );
}
