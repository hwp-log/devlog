'use client';
import { forwardRef } from 'react';
import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion';
import { computePosition, autoUpdate, offset, shift, size } from '@floating-ui/dom';
import {
  ToolList, TOOL_SHELL, buildToolItems, computeActiveMap, computeCanMap,
  type ToolItem, type ToolListHandle,
} from './ToolList';

// 슬래시 메뉴(0468 통합) — 항목·행·셸은 공용 ToolList 한 벌(진입점별 분리 없음, can이 회색으로
// 걸러줌). 이 파일은 발동(Suggestion)·포지셔닝만 담당한다. 발동 조건은 불변:
// "/" 입력·줄 시작·문단만·콜아웃 제외. 0463의 억제 배선(isSuppressed·closeHandleRef)은
// 제거 — 전제였던 "더보기 팝오버와 오버레이 동시 표시"가 툴바 자리 스왑 전환으로 소멸.

interface SlashHostProps {
  items: ToolItem[];
  command: (item: ToolItem) => void;
  onClose: () => void; // ✕ — ESC와 같은 destroy 경로
}

// ReactRenderer 마운트 단위 — 플로팅 셸(TOOL_SHELL) 안에 공용 ToolList
const SlashHost = forwardRef<ToolListHandle, SlashHostProps>(function SlashHost(
  { items, command, onClose },
  ref,
) {
  return (
    <div className={TOOL_SHELL}>
      <ToolList ref={ref} items={items} command={command} onClose={onClose} />
    </div>
  );
});

// onFormat 배선 없음(0471) — 서식은 글 시작 1회성이라 슬래시 맥락에서 제외.
// buildToolItems가 onFormat 미제공 시 항목 자체를 안 만든다(ToolList 주석 참조)
export function createSlashCommand(onImagePick: () => void) {
  return Extension.create({
    name: 'slashCommand',
    addProseMirrorPlugins() {
      return [
        Suggestion<ToolItem, ToolItem>({
          editor: this.editor,
          char: '/',
          startOfLine: true,
          // 제목·인용 등 다른 블록 내부에서는 발동하지 않음 (문단만).
          // 콜아웃 내부 문단도 제외 — 스키마상 중첩 불가지만 메뉴 자체를 안 띄워 UX로도 차단
          allow: ({ state, range }) => {
            const $pos = state.doc.resolve(range.from);
            if ($pos.parent.type.name !== 'paragraph') return false;
            for (let d = $pos.depth; d > 0; d--) {
              if ($pos.node(d).type.name === 'callout') return false;
            }
            return true;
          },
          // 공용 항목을 호출 시점 실시간 can·active로 빌드 — selector 리렌더가 없는
          // 컨텍스트라 두 맵을 직접 평가(단일 소스는 ToolList.computeCanMap·computeActiveMap 한 곳).
          // active는 캐럿 위치의 마크·블록 상태 → 체크마크(0469)가 진입점 간 같은 기준
          items: ({ query, editor }) => {
            const all = buildToolItems(
              { ...computeCanMap(editor), ...computeActiveMap(editor) },
              { onImagePick },
            );
            const q = query.toLowerCase();
            return all.filter(
              (item) =>
                item.label.toLowerCase().includes(q) ||
                item.keywords.some((k) => k.toLowerCase().includes(q)),
            );
          },
          // run이 range를 받아 deleteRange를 같은 체인에 선행(단일 트랜잭션) — ToolList.chainRun
          command: ({ editor, range, props }) => props.run(editor, range),
          render: () => {
            let component: ReactRenderer<ToolListHandle, SlashHostProps> | null = null;
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
              const tb = tabbarEl?.getBoundingClientRect();
              const bottomReserve = tb && tb.height > 0 ? window.innerHeight - tb.top + 8 : 8;
              computePosition(virtualEl, el, {
                strategy: 'fixed',
                placement: 'bottom-start',
                middleware: [
                  offset(8),
                  shift({ padding: 8 }),
                  size({
                    padding: { top: 8, right: 8, bottom: bottomReserve, left: 8 },
                    // 가용 높이를 --tool-avail로 주입 → ToolList 스크롤 영역이
                    // min(--tool-max, --tool-avail)로 읽는다(0468 — 구 --slash-max-h 대체).
                    // 고정 상한(모바일 70/데스크톱 156)은 ToolList --tool-max 소관이라 여기선
                    // 화면 하단·탭바 회피(0398) 하한 120px 방어만 유지.
                    apply({ availableHeight }) {
                      // 열릴 때 1회만 고정(0473) — 매 프레임 갱신은 스크롤 중 높이 연속 변동
                      // (데스크톱 하단 120~156px)의 원인. 열린 뒤의 하단 침범은 "캐럿 따라
                      // 화면 밖 허용" 사양(위 reposition 주석)과 동일 결. 요소는 열림마다
                      // 새로 생성(destroy)되므로 재오픈 시 재계산된다
                      if (!el.style.getPropertyValue('--tool-avail')) {
                        el.style.setProperty('--tool-avail', `${Math.max(120, availableHeight)}px`);
                      }
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
            };

            return {
              onStart: (props) => {
                component = new ReactRenderer(SlashHost, {
                  props: { items: props.items, command: props.command, onClose: destroy },
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
              },
              onUpdate: (props) => {
                component?.updateProps({ items: props.items, command: props.command, onClose: destroy });
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
