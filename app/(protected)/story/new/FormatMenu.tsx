'use client';
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { computePosition, autoUpdate, offset, flip, shift } from '@floating-ui/dom';
import { LayoutTemplate } from 'lucide-react';
import { STORY_FORMS, resolveFormatInsertion } from '@/lib/story/template';
import { docHasUserContent } from '@/lib/story/empty-sections-doc';

// 툴바 우측 끝 "서식" 버튼 + 팝오버. 양식 5종 중 하나를 고르면 본문이 그 양식으로 바뀐다.
// 0359: 교체는 항상 전체 교체 — 업계 표준(Confluence·Google Docs: 템플릿은 생성 시점 적용,
// 기존 문서 병합 없음)에 맞춰 survivor 병합(0355) 폐기. 파괴적 동작이므로 사용자가 쓴 내용이
// 있으면 같은 팝오버가 확인 화면으로 전환된다(모달 금지 — 레이어 두 겹·모바일 답답함으로 기각).
// 모바일엔 Ctrl+Z가 없어 확인 단계가 유일한 방어선 — 즉시 교체는 "내용 없음"(빈 본문·예시
// 원문 그대로, docHasUserContent) 판정일 때만.
// 팝오버는 React 트리 안에 인라인 렌더 — Pretendard가 상속으로 보존됨(0326 body-mount 문제 회피).
// 위치만 @floating-ui/dom(strategy 'fixed', 0325 SlashCommand와 동일 — transform 조상 무관).
export function FormatMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  // 확인 화면 상태 — null이면 목록, 양식이 담기면 그 양식으로의 교체 확인 화면
  const [pendingForm, setPendingForm] = useState<(typeof STORY_FORMS)[number] | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const cancelRef = useRef<HTMLButtonElement>(null);

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

  // 확인 화면 진입 시 포커스는 "취소" — 파괴적 확인은 안전한 쪽이 기본(Enter 습관 클릭 방지).
  useEffect(() => {
    if (pendingForm) cancelRef.current?.focus();
  }, [pendingForm]);

  // 확인 → 목록 복귀(취소·ESC 공용). 포커스는 직전 활성 항목으로(키보드 연속성) —
  // 목록 버튼이 재마운트된 뒤여야 해서 rAF로 한 프레임 미룸(activeIndex를 이펙트 deps에
  // 넣으면 hover 이동마다 포커스를 훔치는 부작용이 있어 핸들러 방식 채택).
  function backToList() {
    setPendingForm(null);
    requestAnimationFrame(() => itemRefs.current[activeIndex]?.focus());
  }

  function toggle() {
    setActiveIndex(0); // 다음에 열 때 항상 첫 항목부터(닫힘 시엔 무의미, 무해)
    setPendingForm(null); // 열 때 항상 목록부터
    setOpen((o) => !o);
  }

  // 바깥 클릭 닫기 — 버튼·팝오버 밖 pointerdown이면 닫음(모달 아님). 확인 화면에서도
  // 닫힘 = 취소와 동일한 무해 동작이라 두 모드 공통.
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

  // 항목 선택 — 쓴 내용이 없으면(빈 본문·예시 원문 그대로) 즉시 교체, 있으면 확인 화면으로
  function chooseForm(form: (typeof STORY_FORMS)[number]) {
    if (docHasUserContent(editor.state.doc)) {
      setPendingForm(form);
    } else {
      applyForm(form);
    }
  }

  // 전체 교체 — setContent 단일 트랜잭션(undo 1회로 교체 전 복원). 자유형은 '' → 빈 본문.
  // setContent는 emitUpdate 기본 true라 hidden input 동기됨.
  function applyForm(form: (typeof STORY_FORMS)[number]) {
    editor.chain().focus().setContent(resolveFormatInsertion(form)).run();
    setPendingForm(null);
    setOpen(false);
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    if (pendingForm) {
      // 확인 화면: ESC = 취소(목록 복귀). 팝오버 닫기 ESC와 같은 핸들러의 분기라 충돌 없음.
      if (e.key === 'Escape') {
        e.preventDefault();
        backToList();
      }
      return; // 화살표 순회는 목록 모드 전용
    }
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
          // 같은 팝오버 셸(폭·위치)에서 내용만 전환 — 목록은 menu, 확인은 dialog 어휘
          role={pendingForm ? 'dialog' : 'menu'}
          aria-label={pendingForm ? '양식 바꾸기' : '본문 양식'}
          onKeyDown={onMenuKeyDown}
          style={{ position: 'fixed', top: 0, left: 0, zIndex: 50 }}
          className="min-w-[240px] rounded-[10px] border-[0.5px] border-border bg-card p-1 shadow-lg"
        >
          {pendingForm ? (
            <div className="px-2 pt-1.5 pb-1">
              <p className="text-xs font-medium text-muted">양식 바꾸기</p>
              <p className="mt-1.5 text-sm font-medium text-fg break-keep">
                {pendingForm.name}으로 바꿀까요?
              </p>
              <p className="mt-1 text-xs text-muted break-keep">지금 쓴 내용은 사라져요.</p>
              {/* 확인이 유일한 방어선(모바일 Ctrl+Z 부재) — 터치 타겟 44px·간격 8px(§5) */}
              <div className="mt-3 flex gap-2">
                <button
                  ref={cancelRef}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={backToList}
                  className="flex-1 min-h-[44px] rounded px-2 text-sm font-medium text-fg2 hover:bg-popover transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyForm(pendingForm)}
                  className="flex-1 min-h-[44px] rounded px-2 text-sm font-medium bg-surface2 text-fg hover:bg-popover transition-colors"
                >
                  바꾸기
                </button>
              </div>
            </div>
          ) : (
            STORY_FORMS.map((form, i) => (
              <button
                key={form.key}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={i === activeIndex ? 0 : -1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => chooseForm(form)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full rounded px-2 py-1.5 text-left transition-colors ${
                  i === activeIndex ? 'bg-surface2' : 'hover:bg-popover'
                }`}
              >
                <span className="block text-sm font-medium text-fg">{form.name}</span>
                <span className="block text-xs text-muted">{form.description}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
