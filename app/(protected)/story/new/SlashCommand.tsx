'use client';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Extension, type Editor, type Range } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion';
import { computePosition, flip, offset, shift } from '@floating-ui/dom';

interface SlashItem {
  label: string;
  keywords: string[];
  run: (editor: Editor, range: Range) => void;
}

function buildItems(onImagePick: () => void): SlashItem[] {
  return [
    {
      label: '제목',
      keywords: ['제목', 'h2', 'heading', 'title'],
      // 본문 최상위 제목은 h2 — 페이지 제목 input이 h1 역할(0332 시각 병합·툴바 H1 제거와 동기)
      run: (editor, range) =>
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
    },
    {
      label: '목록',
      keywords: ['목록', 'list', '불릿', 'bullet'],
      run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
    },
    {
      label: '인용',
      keywords: ['인용', 'quote', 'blockquote'],
      run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
    {
      label: '이미지',
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
    <div className="min-w-[140px] rounded-[10px] border-[0.5px] border-border bg-card p-1 shadow-lg">
      {items.length === 0 ? (
        <div className="px-2 py-1 text-sm text-muted">결과 없음</div>
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
            className={`w-full rounded px-2 py-1 text-left text-sm font-medium transition-colors ${
              i === selectedIndex ? 'bg-surface2 text-fg' : 'text-fg2 hover:bg-popover'
            }`}
          >
            {item.label}
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
