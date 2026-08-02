'use client';
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { computePosition, autoUpdate, offset, flip, shift } from '@floating-ui/dom';
import { LayoutTemplate, TriangleAlert } from 'lucide-react';
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

// 0461: 목록+확인 UI를 콘텐츠 컴포넌트로 추출 — 데스크톱 서식 팝오버(아래 FormatMenu)와
// 모바일 더보기 팝오버(ToolbarMore)가 같은 "셸에서 내용만 전환" 패턴(0359)으로 공유한다.
// 내부 상태(activeIndex·pendingForm)는 호스트가 열릴 때만 마운트되므로 리셋 코드 없이
// "열 때 항상 목록부터"가 성립한다.
export function FormatMenuContent({
  editor,
  onDone,
  onEscape,
  autoFocus = true,
  compactConfirm = false,
}: {
  editor: Editor;
  onDone: () => void; // 양식 적용 완료 — 호스트 팝오버 전체 닫기
  onEscape?: () => void; // 목록 모드 ESC — 호스트가 닫기(또는 이전 뷰 복귀)·포커스 복귀 담당
  // 0468: 툴바 스왑 format 뷰는 false — 마운트 포커스가 에디터를 blur시켜 iOS 선택 표시를
  // 거두는 것을 방지(0467 원칙). 데스크톱 팝오버(아래 FormatMenu)는 기본 true로 키보드 진입 유지
  autoFocus?: boolean;
  // 0477→0478: 확인 화면 compact 변형 — 툴바 스왑(70px 스크롤 영역)용. 질문 1행 + 동작
  // 라벨 버튼 2행, 제목·캡션 생략(70px 예산 — 산식은 아래 compact 렌더 주석).
  // 0476의 헤더 포털은 "답이 질문보다 위" 문맥 역전으로 폐기 — 레이아웃 분기로 대체.
  // 기본 false(데스크톱 팝오버) = 스택 레이아웃·캡션 유지 — 무변이 코드 경로로 보장
  compactConfirm?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  // 확인 화면 상태 — null이면 목록, 양식이 담기면 그 양식으로의 교체 확인 화면
  const [pendingForm, setPendingForm] = useState<(typeof STORY_FORMS)[number] | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 마운트 = 호스트 열림 시점 — 첫 항목으로 포커스(키보드 진입, autoFocus 시에만)
  useEffect(() => {
    if (autoFocus) itemRefs.current[0]?.focus();
  }, [autoFocus]);

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
    onDone();
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    if (pendingForm) {
      // 확인 화면: ESC = 취소(목록 복귀). 호스트 닫기 ESC와 같은 핸들러의 분기라 충돌 없음.
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
      onEscape?.();
    }
  }

  return (
    // 같은 팝오버 셸(폭·위치)에서 내용만 전환 — 목록은 menu, 확인은 dialog 어휘
    <div
      role={pendingForm ? 'dialog' : 'menu'}
      aria-label={pendingForm ? '양식 바꾸기' : '본문 양식'}
      onKeyDown={onMenuKeyDown}
    >
      {pendingForm ? (
        (() => {
          // 버튼 한 벌 — 두 레이아웃이 같은 요소·핸들러를 공유.
          // 라벨·스타일(0478): 예/아니오는 파괴적 확인에서 기피 대상(라벨-동작 짝짓기의
          // 멈칫이 실수로) — 동작 라벨 + SpotPopup 수정·삭제 버튼 어휘 재사용(새 색 금지).
          // 순서도 SpotPopup 대칭(중립 좌·파괴 우). 원본과의 차이는 min-h-[44px]뿐
          // (SpotPopup py-1.5 ≈36px → §5 터치 타겟 44px 강화). 파괴 쪽은 빨간 테두리 +
          // 경고 아이콘 + 대상 라벨("양식 바꾸기") — 색만으로 의미 전달 금지(§9)
          const buttons = (
            <>
              <button
                ref={cancelRef}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={backToList}
                className="flex-1 min-h-[44px] rounded-lg text-sm bg-surface2 text-fg2 border border-border hover:bg-popover transition-colors"
              >
                그대로 두기
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyForm(pendingForm)}
                className="flex-1 min-h-[44px] rounded-lg text-sm text-red-500 border border-red-200 hover:bg-red-50 transition-colors flex items-center justify-center gap-1"
              >
                <TriangleAlert size={12} /> 양식 바꾸기
              </button>
            </>
          );
          return compactConfirm ? (
            // compact(0478, 툴바 70px 영역): 질문 1행 + 버튼 2행 = pt2+20+mt4+44 = 70px 정확.
            // 캡션 생략(사용자 확정) — 360px 가용 폭 ≈278px에서 질문+캡션(최단 ≈285px)은
            // 반드시 접혀 84px>70px가 되므로. 파괴성 신호는 버튼으로 이관(위 주석).
            // 질문 단독 최장 ≈194px — 한 줄 보장
            <div className="px-2 pt-0.5">
              <p className="text-sm font-medium text-fg break-keep">
                {pendingForm.name}으로 바꿀까요?
              </p>
              <div className="mt-1 flex gap-2">{buttons}</div>
            </div>
          ) : (
            // 기본(데스크톱 팝오버): 스택 레이아웃·캡션 유지(폭 여유) — 버튼 한 벌만 교체(0478)
            <div className="px-2 pt-1.5 pb-1">
              <p className="text-xs font-medium text-muted">양식 바꾸기</p>
              <p className="mt-1.5 text-sm font-medium text-fg break-keep">
                {pendingForm.name}으로 바꿀까요?
              </p>
              <p className="mt-1 text-xs text-muted break-keep">지금 쓴 내용은 사라져요.</p>
              <div className="mt-3 flex gap-2">{buttons}</div>
            </div>
          );
        })()
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
  );
}

export function FormatMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

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

  return (
    // max-sm:hidden(0461·0462) — 모바일 진입점은 ToolbarMore 안 FormatMenuContent, 이 트리거는 데스크톱 전용.
    // 숨김 관용구는 툴바 한 벌(max-sm:hidden)로 통일 — 무접두 hidden의 v4 순서 함정은 TiptapEditor 주석 참조
    <div className="ml-auto max-sm:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="format-menu"
        // mousedown preventDefault — 에디터 선택/포커스 유지(다른 툴바 버튼 관례와 동일)
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
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
          style={{ position: 'fixed', top: 0, left: 0, zIndex: 50 }}
          className="min-w-[240px] rounded-[10px] border-[0.5px] border-border bg-card p-1 shadow-lg"
        >
          <FormatMenuContent
            editor={editor}
            onDone={() => setOpen(false)}
            onEscape={() => {
              setOpen(false);
              buttonRef.current?.focus();
            }}
          />
        </div>
      )}
    </div>
  );
}
