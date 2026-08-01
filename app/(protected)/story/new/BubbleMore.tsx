'use client';
import { useEffect, useRef, useState } from 'react';
import { posToDOMRect, type Editor } from '@tiptap/core';
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

// 비활성 판정(0464-d) — TiptapEditor useEditorState can 맵 공유(단일 소스, 툴바·버블과 동일).
// 필요한 필드만 명시 — 전달되는 실제 객체는 상위 맵 전체(구조적 타이핑)
type CanMap = {
  canSize: boolean;
  canStrike: boolean;
  canCode: boolean;
  canLink: boolean;
  canHeading2: boolean;
  canHeading3: boolean;
  canBulletList: boolean;
  canBlockquote: boolean;
} | null;

interface BubbleMoreProps {
  editor: Editor;
  active: CanMap;
  onLink: () => void; // TiptapEditor.handleLink — URL prompt 로직 중복 금지
  // 0463 억제 배선 그대로 수신 — 목록 열림 중 "/" 타이핑 억제·슬래시 열림 중 목록 열기 시 슬래시 닫기
  onOpenChange?: (open: boolean) => void;
}

type Item = { label: string; description: string; icon: LucideIcon; disabled: boolean; run: () => void };

export function BubbleMore({ editor, active, onLink, onOpenChange }: BubbleMoreProps) {
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // 키보드로 열었는지(0466 후속) — 터치·마우스는 트리거 mousedown preventDefault로 포커스를
  // 안 받아 false. 터치 열림에 항목 auto-focus를 걸면 에디터가 blur돼 iOS가 선택 표시를
  // 거둔다(실기기 "선택 풀림"의 실제 원인 — invisible 아님. PM 상태 선택은 blur 중
  // selectionchange를 PM이 게이팅해 안 무너짐을 실증). 키보드 열림만 포커스해 순회 보존
  const openedByKeyboardRef = useRef(false);

  // 그룹 헤더를 두는 이유(사용자 확정): 텍스트 마크는 고른 구간에만 걸리고,
  // 블록 변환은 선택이 걸친 문단 전체가 바뀐다 — 적용 결과가 달라 구분 표기.
  // 라벨·설명·아이콘은 툴바·슬래시 기존 어휘 재사용.
  // disabled(0464-d) — can 맵 false만 비활성(맵 null=판정 불가 시 활성 유지).
  // 실질 발동: 마크 4종=선택 전체가 인라인 코드(excludes "_")·작게는 제목 안 추가,
  // 블록 4종=콜아웃 안(content: paragraph+)
  const groups: { header: string; items: Item[] }[] = [
    {
      header: '텍스트',
      items: [
        { label: '작게', description: '선택한 글자를 작게', icon: AArrowDown, disabled: active?.canSize === false, run: () => editor.chain().focus().toggleSmall().run() },
        { label: '취소선', description: '가운데 줄 긋기', icon: Strikethrough, disabled: active?.canStrike === false, run: () => editor.chain().focus().toggleStrike().run() },
        { label: '인라인 코드', description: '코드 서식', icon: Code, disabled: active?.canCode === false, run: () => editor.chain().focus().toggleCode().run() },
        { label: '링크', description: 'URL 연결', icon: LinkIcon, disabled: active?.canLink === false, run: onLink },
      ],
    },
    {
      header: '블록으로 바꾸기',
      items: [
        { label: '제목', description: '섹션 제목(H2)', icon: Heading2, disabled: active?.canHeading2 === false, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
        { label: '소제목', description: '소제목(H3)', icon: Heading3, disabled: active?.canHeading3 === false, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
        { label: '목록', description: '글머리 기호·번호', icon: List, disabled: active?.canBulletList === false, run: () => editor.chain().focus().toggleBulletList().run() },
        { label: '인용', description: '왼쪽 선 강조', icon: Quote, disabled: active?.canBlockquote === false, run: () => editor.chain().focus().toggleBlockquote().run() },
      ],
    },
  ];
  const flatItems = groups.flatMap((g) => g.items);

  // 위치 계산 — 앵커는 ⋯ 버튼이 아니라 선택 rect 가상 엘리먼트(0465 후속). 트리거 앵커는
  // invisible 버블의 잔존 레이아웃 위(top-end여도 선택 위 ~68px = 버블 높이+오프셋 2회의
  // 죽은 공간)에 목록을 띄워 그만큼 위 본문을 더 가리던 원인. 버블 플러그인과 같은 기준
  // (posToDOMRect)으로 목록이 버블이 있던 자리(선택 위 8px)에 얹힌다. from/to는 열림 시점
  // 고정 — 목록 열림 중 PM 선택 불변. contextElement로 autoUpdate 조상 스크롤 추적 유지.
  useEffect(() => {
    if (!open) return;
    const pop = popRef.current;
    if (!pop) return;
    const { from, to } = editor.state.selection;
    const virtualEl = {
      getBoundingClientRect: () => posToDOMRect(editor.view, from, to),
      contextElement: editor.view.dom,
    };
    return autoUpdate(virtualEl, pop, () => {
      computePosition(virtualEl, pop, {
        strategy: 'fixed',
        // top-end(0464-d) — 목록은 위쪽(이미 읽은 이전 줄 방향), 상단 공간 부족 시 flip() 아래 폴백
        placement: 'top-end',
        middleware: [offset(8), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        Object.assign(pop.style, { left: `${x}px`, top: `${y}px` });
      });
    });
  }, [open, editor]);

  // 키보드 열림일 때만 첫 "활성" 항목 포커스(0466 후속) — 터치 열림은 에디터 포커스를
  // 유지해 선택 표시를 보존한다. 비활성 행은 선택 대상 제외(0465 후속) — 초기 진입도 스킵.
  // 선택 인덱스 설정은 toggle(이벤트 핸들러)에서 — effect 내 setState는 lint 금지
  const initialIndex = Math.max(0, flatItems.findIndex((it) => !it.disabled));
  useEffect(() => {
    // openedByKeyboardRef: 열림 순간(toggle) 기록값을 effect 시점에 읽는 지연 참조
    if (open && openedByKeyboardRef.current) itemRefs.current[initialIndex]?.focus();
  }, [open, initialIndex]);

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
    openedByKeyboardRef.current = document.activeElement === buttonRef.current;
    setSelectedIndex(initialIndex); // 첫 활성 행부터(비활성 스킵) — 포커스는 열림 effect가 담당
    setOpen((o) => !o);
  }

  function runItem(item: Item) {
    if (item.disabled) return; // aria-disabled 행 — 포커스·순회는 유지, 실행만 차단
    item.run();
    setOpen(false);
  }

  // 화살표 이동은 비활성 행 스킵(0465 후속) — 선택 하이라이트(bg-surface2)가 비활성 행에
  // 얹히면 "비활성=콘텐츠 강등 / 선택=배경 채움" 상태 축이 무너진다. 전부 비활성이면 제자리
  function step(from: number, dir: 1 | -1) {
    const count = flatItems.length;
    let n = from;
    for (let k = 0; k < count; k++) {
      n = (n + dir + count) % count;
      if (!flatItems[n].disabled) return n;
    }
    return from;
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const n = step(selectedIndex, 1);
      setSelectedIndex(n);
      itemRefs.current[n]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const n = step(selectedIndex, -1);
      setSelectedIndex(n);
      itemRefs.current[n]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  // 닫기 공용(뒤로·ESC) — 트리거 포커스 복귀는 포커스가 메뉴 안일 때만(0466 후속):
  // 터치 열림에선 에디터가 포커스를 갖고 있어, 무조건 복귀시키면 여기서 에디터 포커스를
  // 뺏어 선택 표시가 사라진다. 버블이 항상 보이므로(invisible 철회) rAF 지연도 불요
  function close() {
    const focusInMenu = popRef.current?.contains(document.activeElement) ?? false;
    setOpen(false);
    if (focusInMenu) buttonRef.current?.focus();
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
          style={{ position: 'fixed', top: 0, left: 0, zIndex: 50 }}
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
                        // native disabled 아닌 aria-disabled(0464-d) — 메뉴 패턴 표준: 비활성 항목도
                        // 포커스·화살표 순회에 남겨 발견 가능하게(WAI-ARIA), roving tabindex 무파손.
                        // 실행 차단은 runItem 가드. 스타일은 disabled: 의사클래스가 안 걸려 조건부 클래스
                        aria-disabled={item.disabled || undefined}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => runItem(item)}
                        // 비활성 행은 선택 대상 제외(0465 후속) — iOS는 탭이 mouseenter를 발화하고
                        // mouseleave가 없어, 비활성 행 탭(실행 안 됨·메뉴 유지) 시 하이라이트가
                        // 잔존하던 "안 풀리는 hover"의 원인. 활성 행은 탭 즉시 닫혀 무증상
                        onMouseEnter={() => { if (!item.disabled) setSelectedIndex(i); }}
                        // hover 클래스 없음 — onMouseEnter가 selectedIndex를 옮겨 hover=선택=surface2 단일 상태 언어(SlashMenu 규칙)
                        className={`flex w-full items-center gap-2.5 rounded-lg px-[9px] py-2 text-left transition-colors ${
                          i === selectedIndex && !item.disabled ? 'bg-surface2' : ''
                        } ${item.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border-[0.5px] border-border bg-surface2 text-muted">
                          <item.icon size={16} />
                        </span>
                        <span className="flex flex-col">
                          {/* 비활성 라벨은 muted 강등(0465 후속) — opacity 단독은 실기기 식별 불가 */}
                          <span className={`text-[13px] font-medium ${item.disabled ? 'text-muted' : 'text-fg'}`}>{item.label}</span>
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
