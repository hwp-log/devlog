'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Extension, type Editor, type Range } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion';
import { computePosition, autoUpdate, offset, shift, size } from '@floating-ui/dom';
import {
  Heading2, List, Quote, Image as ImageIcon,
  Lightbulb, MessageCircleQuestion, TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

interface SlashItem {
  label: string;
  description: string;
  icon: LucideIcon; // 툴바(0333)와 같은 lucide 재사용
  keywords: string[];
  run: (editor: Editor, range: Range) => void;
}

function buildItems(onImagePick: () => void): SlashItem[] {
  return [
    {
      label: '제목',
      description: '섹션 제목(H2)', // H2만 — 슬래시는 H3 미추가(0333 확정), 문구-동작 정합
      icon: Heading2,
      keywords: ['제목', 'h2', 'heading', 'title'],
      // 본문 최상위 제목은 h2 — 페이지 제목 input이 h1 역할(0332 시각 병합·툴바 H1 제거와 동기)
      run: (editor, range) =>
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
    },
    {
      label: '목록',
      description: '글머리 기호·번호',
      icon: List,
      keywords: ['목록', 'list', '불릿', 'bullet'],
      run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
    },
    {
      label: '인용',
      description: '왼쪽 선 강조',
      icon: Quote,
      keywords: ['인용', 'quote', 'blockquote'],
      run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
    {
      label: '이미지',
      description: '사진 업로드',
      icon: ImageIcon,
      keywords: ['이미지', 'image', '사진', 'photo'],
      run: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        onImagePick();
      },
    },
    // 콜아웃 3종 — 라벨·설명에 이모지 금지(종류 표시는 블록 자체의 ::before가 담당)
    {
      label: '팁',
      description: '핵심 팁 강조 상자',
      icon: Lightbulb,
      keywords: ['팁', 'tip', 'callout', '콜아웃'],
      run: (editor, range) => editor.chain().focus().deleteRange(range).insertCallout('tip').run(),
    },
    {
      label: 'FAQ',
      description: '질문·답변 상자',
      icon: MessageCircleQuestion,
      keywords: ['faq', '질문', '문답', 'callout', '콜아웃'],
      run: (editor, range) => editor.chain().focus().deleteRange(range).insertCallout('faq').run(),
    },
    {
      label: '주의',
      description: '주의사항 강조 상자',
      icon: TriangleAlert,
      keywords: ['주의', 'warn', 'warning', 'caution', 'callout', '콜아웃'],
      run: (editor, range) => editor.chain().focus().deleteRange(range).insertCallout('warn').run(),
    },
  ];
}

interface SlashMenuProps {
  items: SlashItem[];
  command: (item: SlashItem) => void;
}

interface SlashMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(function SlashMenu(
  { items, command },
  ref,
) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  // 메뉴 내부 스크롤(size()로 max-height 제한)이 생겨도 키보드 이동 시 선택 항목이 보이게 스크롤.
  // block:'nearest'라 이미 보이면 no-op, 페이지 스크롤은 overscroll-none이 막는다.
  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown(event) {
        if (items.length === 0) return false;
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          command(items[selectedIndex]);
          return true;
        }
        return false;
      },
    }),
    [items, selectedIndex, command],
  );

  return (
    // 셸은 시안의 popover 대신 bg-card — surface2(타일·활성 행)가 popover 위에선 1.04~1.05:1로
    // 식별 불가 실측, card 위에선 1.09/1.13(현행 선택 표시와 같은 검증 수준). FormatMenu·BubbleMenu와 동일 어휘.
    // max-height는 size() 미들웨어가 가용 공간에 맞춰 --slash-max-h로 주입(캐럿이 화면 아래쪽일 때 화면 밖으로
    // 넘치지 않게). 넘치면 내부 스크롤 + overscroll-none으로 페이지 스크롤 전파 차단(0389 선례).
    <div
      // 상단 패딩 제거(pt-0) — 스크롤 셸에 padding-top이 있으면 sticky top-0 라벨이 그 패딩 박스
      // 아래에 붙어, 노출된 상단 패딩 밴드로 스크롤된 항목이 비쳐 삐져나온다. 상단 여백은 라벨이 담당.
      className="w-[250px] rounded-[12px] border border-border bg-card px-1.5 pb-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)] overflow-y-auto overscroll-none"
      style={{ maxHeight: 'var(--slash-max-h)' }}
    >
      {/* 눈썹 라벨 — 10px은 §5(12px 하한)의 확정 예외: 읽는 텍스트가 아닌 장식성 그룹 라벨.
          sticky top-0으로 상단 고정 + 셸 pt-0이라 테두리에 밀착 → 스크롤된 항목을 bg-card로 완전히 가림(비침 없음).
          pt-3은 셸에서 없앤 상단 여백 보전(기존 셸6+라벨6=12px 유지). */}
      <div className="sticky top-0 bg-card px-[9px] pt-3 pb-1 text-[10px] tracking-[0.08em] text-muted">블록</div>
      {items.length === 0 ? (
        <div className="px-[9px] py-2 text-sm text-muted">결과 없음</div>
      ) : (
        items.map((item, i) => (
          <button
            key={item.label}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              command(item);
            }}
            onMouseEnter={() => setSelectedIndex(i)}
            // hover 클래스 없음 — onMouseEnter가 selectedIndex를 옮겨 hover=선택=surface2 단일 상태 언어
            className={`flex w-full items-center gap-2.5 rounded-lg px-[9px] py-2 text-left transition-colors ${
              i === selectedIndex ? 'bg-surface2' : ''
            }`}
          >
            {/* 타일은 헤어라인 테두리로 활성 행(surface2) 위에서도 식별 유지 */}
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border-[0.5px] border-border bg-surface2 text-muted">
              <item.icon size={16} />
            </span>
            <span className="flex flex-col">
              <span className="text-[13px] font-medium text-fg">{item.label}</span>
              <span className="mt-px text-xs text-muted">{item.description}</span>
            </span>
          </button>
        ))
      )}
    </div>
  );
});

// isSuppressed·closeHandleRef(0463) — 더보기 패널과의 동시 표시 방지 양방향 배선.
// 둘 다 ref 지연 참조 패턴(0457 이미지 콜백과 동일): extensions가 useMemo []로 고정돼
// 값을 갈아끼울 수 없으므로, 호출 시점에 ref를 읽는 함수/핸들만 1회 주입한다.
export function createSlashCommand(
  onImagePick: () => void,
  isSuppressed?: () => boolean,
  closeHandleRef?: { current: (() => void) | null },
) {
  const allItems = buildItems(onImagePick);

  return Extension.create({
    name: 'slashCommand',
    addProseMirrorPlugins() {
      return [
        Suggestion<SlashItem, SlashItem>({
          editor: this.editor,
          char: '/',
          startOfLine: true,
          // 제목·인용 등 다른 블록 내부에서는 발동하지 않음 (문단만).
          // 콜아웃 내부 문단도 제외 — 스키마상 중첩 불가지만 메뉴 자체를 안 띄워 UX로도 차단
          allow: ({ state, range }) => {
            // 더보기 패널 열림 중엔 억제(0463) — "/"는 일반 문자로만 입력, 오버레이 동시 표시 금지
            if (isSuppressed?.()) return false;
            const $pos = state.doc.resolve(range.from);
            if ($pos.parent.type.name !== 'paragraph') return false;
            for (let d = $pos.depth; d > 0; d--) {
              if ($pos.node(d).type.name === 'callout') return false;
            }
            return true;
          },
          items: ({ query }) => {
            const q = query.toLowerCase();
            return allItems.filter(
              (item) =>
                item.label.toLowerCase().includes(q) ||
                item.keywords.some((k) => k.toLowerCase().includes(q)),
            );
          },
          command: ({ editor, range, props }) => props.run(editor, range),
          render: () => {
            let component: ReactRenderer<SlashMenuHandle, SlashMenuProps> | null = null;
            // 스크롤·리사이즈 시 autoUpdate가 캐럿을 계속 따라가게 하는 disposer (FormatMenu 0336과 동일 결).
            let cleanup: (() => void) | null = null;
            // 최신 캐럿 rect 함수 — onUpdate에서 갱신, autoUpdate 콜백이 매 틱 호출해 스크롤 후 위치를 다시 읽는다.
            let latestRect: SuggestionProps['clientRect'] = null;
            // 모바일 하단 탭바(z-40) — size()의 하단 여유 계산에 실측 rect 사용(safe-area 자동 반영).
            // 데스크톱은 lg:hidden이라 height 0 → 여유 없음. onStart에서 캐시.
            let tabbarEl: HTMLElement | null = null;

            // fixed는 뷰포트 기준 — 마운트 부모와 무관 (조상 체인 transform 없음 확인).
            // contextElement는 autoUpdate가 에디터 스크롤 조상까지 감지하도록 onStart에서 채운다.
            const virtualEl: {
              getBoundingClientRect: () => DOMRect;
              contextElement?: Element;
            } = {
              getBoundingClientRect: () => latestRect?.() ?? new DOMRect(),
            };

            const reposition = () => {
              const el = component?.element as HTMLElement | undefined;
              if (!el || !latestRect) return;
              // 캐럿을 그대로 따라간다 — 화면 밖으로 나가도 숨기지 않는다. 메뉴 z-index를
              // 헤더(sticky z-10)보다 낮춰(onStart z-9) 스크롤로 캐럿이 헤더 위로 넘어가면
              // 메뉴가 헤더 뒤로 자연스럽게 스르륵 밀려 들어간다. suggestion 상태·입력 필터도 보존.
              // 항상 캐럿 '아래'로 고정 — flip()을 빼서 아래 공간 여부에 따라 위아래로 튀지 않게 한다.
              // 하단 여유(bottomReserve): 모바일 탭바(z-40)를 침범하지 않게 탭바 top까지 예약.
              // z를 헤더 아래로 둔 채(헤더 뒤 tuck 유지) 탭바 가림을 피하는 유일한 방법 — 메뉴가
              // 애초에 탭바에 닿지 않도록 size()가 가용 높이를 줄인다. 데스크톱은 탭바 height 0 → 8px.
              const tb = tabbarEl?.getBoundingClientRect();
              const isMobile = !!(tb && tb.height > 0); // 탭바 노출 = 모바일 신호(데스크톱은 lg:hidden으로 height 0)
              const bottomReserve = tb && tb.height > 0 ? window.innerHeight - tb.top + 8 : 8;
              computePosition(virtualEl, el, {
                strategy: 'fixed',
                placement: 'bottom-start',
                middleware: [
                  offset(8),
                  shift({ padding: 8 }),
                  size({
                    padding: { top: 8, right: 8, bottom: bottomReserve, left: 8 },
                    // 가용 높이를 --slash-max-h로 주입 → 셸이 max-height로 읽어 넘치면 내부 스크롤.
                    // 모바일은 고정 상한(MOBILE_MAX_H) — 키보드를 내려 공간이 넓어져도 커지지 않게(모양 일정).
                    //   ≈ 라벨 24 + 항목 3.5행(52×3.5) + 상단 6 ≈ 208px(항목 2~3개 + 스크롤 어포던스).
                    //   상한이지 하한이 아니라, 가용 공간이 더 작으면(키보드 위 등) 그에 맞춘다(min).
                    // 데스크톱은 상한 없이 가용 공간에 맞춰 커짐(기존 동작).
                    // 120px 하한은 탭바 바로 위 극단 케이스 방어(0398) — 그대로 유지.
                    apply({ availableHeight }) {
                      const MOBILE_MAX_H = 208;
                      const target = isMobile ? Math.min(MOBILE_MAX_H, availableHeight) : availableHeight;
                      el.style.setProperty('--slash-max-h', `${Math.max(120, target)}px`);
                    },
                  }),
                ],
              }).then(({ x, y }) => {
                // 소수 좌표는 흐릿함·미세 떨림의 원인 — 기기 픽셀 그리드에 스냅(floating-ui roundByDPR 권장).
                const dpr = window.devicePixelRatio || 1;
                const rx = Math.round(x * dpr) / dpr;
                const ry = Math.round(y * dpr) / dpr;
                // top/left 대신 transform — 리페인트 대신 컴포지터 레이어에서 이동해 갱신이 매끄럽다(translate3d로 레이어 승격).
                el.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
              });
            };

            const destroy = () => {
              cleanup?.();
              cleanup = null;
              (component?.element as HTMLElement | undefined)?.remove();
              component?.destroy();
              component = null;
              // 닫힘 핸들 해제(0463) — 스테일 핸들 차단(SpotPopup closeHandleRef 0378과 동일 규칙)
              if (closeHandleRef) closeHandleRef.current = null;
            };

            return {
              onStart: (props) => {
                component = new ReactRenderer(SlashMenu, {
                  props: { items: props.items, command: props.command },
                  editor: props.editor,
                });
                const el = component.element as HTMLElement;
                el.style.position = 'fixed';
                // transform으로 위치를 주므로 기준점을 0,0으로 고정 — computePosition의 x·y가 이 기준 위 오프셋이 된다.
                el.style.left = '0';
                el.style.top = '0';
                // 헤더(sticky z-10)보다 낮게 — 스크롤로 캐럿이 헤더 위로 넘어가면 메뉴가 헤더 뒤로 스르륵 밀려 들어간다(사라지지 않음)
                el.style.zIndex = '9';
                // body 직속은 Pretendard 상속이 끊김 — EditorContent 래퍼에 마운트
                props.editor.view.dom.parentElement?.appendChild(el);
                latestRect = props.clientRect ?? null;
                virtualEl.contextElement = props.editor.view.dom;
                // 모바일 탭바 컨테이너 캐시(nav 부모 = fixed 바) — size() 하단 여유 계산용. 없으면 null(데스크톱 무해).
                tabbarEl =
                  document.querySelector('nav[aria-label="주요 메뉴"]')?.parentElement ?? null;
                // animationFrame: true — 참조가 캐럿 '가상 요소'라 스크롤·리사이즈 리스너로는 한 프레임 늦게 잡혀
                // 떨림으로 보인다. 매 프레임 rAF로 갱신해 캐럿에 즉시 붙는다. 메뉴 열림 동안만 돌고,
                // 닫힘 시 destroy() → cleanup()으로 rAF 루프가 확실히 멈춘다(disposer 경로).
                cleanup = autoUpdate(virtualEl, el, reposition, { animationFrame: true });
                // 닫힘 핸들 노출(0463) — 더보기 패널이 열릴 때 이 메뉴를 닫는다(ESC와 같은 destroy 경로)
                if (closeHandleRef) closeHandleRef.current = destroy;
              },
              onUpdate: (props) => {
                component?.updateProps({ items: props.items, command: props.command });
                latestRect = props.clientRect ?? latestRect;
                reposition();
              },
              onKeyDown: (props) => {
                if (props.event.key === 'Escape') {
                  destroy();
                  return true;
                }
                return component?.ref?.onKeyDown(props.event) ?? false;
              },
              onExit: destroy,
            };
          },
        }),
      ];
    },
  });
}
