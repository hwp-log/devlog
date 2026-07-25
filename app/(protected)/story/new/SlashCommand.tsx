'use client';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Extension, type Editor, type Range } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion';
import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import { Heading2, List, Quote, Image as ImageIcon, type LucideIcon } from 'lucide-react';

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

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

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
    <div className="w-[250px] rounded-[12px] border border-border bg-card p-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)]">
      {/* 눈썹 라벨 — 10px은 §5(12px 하한)의 확정 예외: 읽는 텍스트가 아닌 장식성 그룹 라벨 */}
      <div className="px-[9px] pt-1.5 pb-1 text-[10px] tracking-[0.08em] text-muted">블록</div>
      {items.length === 0 ? (
        <div className="px-[9px] py-2 text-sm text-muted">결과 없음</div>
      ) : (
        items.map((item, i) => (
          <button
            key={item.label}
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

export function createSlashCommand(onImagePick: () => void) {
  const allItems = buildItems(onImagePick);

  return Extension.create({
    name: 'slashCommand',
    addProseMirrorPlugins() {
      return [
        Suggestion<SlashItem, SlashItem>({
          editor: this.editor,
          char: '/',
          startOfLine: true,
          // 제목·인용 등 다른 블록 내부에서는 발동하지 않음 (문단만)
          allow: ({ state, range }) =>
            state.doc.resolve(range.from).parent.type.name === 'paragraph',
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

            const updatePosition = (clientRect: SuggestionProps['clientRect']) => {
              const el = component?.element as HTMLElement | undefined;
              if (!el || !clientRect) return;
              const virtualEl = {
                getBoundingClientRect: () => clientRect() ?? new DOMRect(),
              };
              // fixed는 뷰포트 기준 — 마운트 부모와 무관 (조상 체인 transform 없음 확인)
              computePosition(virtualEl, el, {
                strategy: 'fixed',
                placement: 'bottom-start',
                middleware: [offset(8), flip(), shift()],
              }).then(({ x, y }) => {
                Object.assign(el.style, { left: `${x}px`, top: `${y}px` });
              });
            };

            const destroy = () => {
              (component?.element as HTMLElement | undefined)?.remove();
              component?.destroy();
              component = null;
            };

            return {
              onStart: (props) => {
                component = new ReactRenderer(SlashMenu, {
                  props: { items: props.items, command: props.command },
                  editor: props.editor,
                });
                const el = component.element as HTMLElement;
                el.style.position = 'fixed';
                el.style.zIndex = '50';
                // body 직속은 Pretendard 상속이 끊김 — EditorContent 래퍼에 마운트
                props.editor.view.dom.parentElement?.appendChild(el);
                updatePosition(props.clientRect);
              },
              onUpdate: (props) => {
                component?.updateProps({ items: props.items, command: props.command });
                updatePosition(props.clientRect);
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
