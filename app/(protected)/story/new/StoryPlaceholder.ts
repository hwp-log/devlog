import { Extension, isNodeEmpty } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { STORY_ALL_SECTIONS } from '@/lib/story/template';

// ── 왜 스톡 @tiptap/extension-placeholder를 안 쓰는가 (스톡으로 되돌리기 전 반드시 읽을 것) ──
// 스톡(3.x)은 데코레이션을 "뷰포트 윈도우(topPos~bottomPos, posAtCoords로 계산)" 안 노드에만 붙이고,
// 그 창을 스크롤 및 doc.content.size 변경 시에만 재계산한다(그 외엔 트랜잭션마다 위치를 map).
// → FormatMenu 양식 교체처럼 "같은 크기의 전체 replace(setContent)"를 하면 size가 안 바뀌어 창이
//    재계산되지 않고, 옛 topPos/bottomPos가 replace 매핑으로 한 점에 붕괴 → nodesBetween 범위가 0 →
//    데코레이션 전멸(빈 문단은 있는데 회색 placeholder가 전부 사라짐). 0336 실측 증상 B가 이것.
// → jsdom(테스트)에선 getBoundingClientRect=0이라 전체 스캔으로 폴백되어 이 버그가 마스킹되고
//    실화면에서만 터진다. 그래서 헤드리스 테스트로는 재현 불가.
// ⇒ 윈도잉 없이 "매 상태변경마다 전 문서를 스캔"하는 결정적 구현으로 대체한다.
//    스톡으로 되돌리면 위 버그가 재발한다.

const storyPlaceholderKey = new PluginKey('storyPlaceholder');

// 커스텀 Placeholder. 매 상태변경마다 top-level을 훑어 "heading 바로 다음에 오는 첫 빈 문단"에만
// data-placeholder + is-empty를 붙인다(그 외 빈 문단엔 안 붙임 → 엔터로 생긴 빈 줄에 안내가
// 반복·겹치지 않음). 도입부는 이제 각 양식의 첫 섹션(heading)이라 특수 분기가 없다.
// 자유형·빈 본문(heading 전무)에서는 어떤 안내도 띄우지 않는다(자유롭게 쓰도록).
// is-empty가 "문구 붙는 문단"에만 있으므로 CSS는 그 문단만 block 처리하면 되고, 안 붙는 빈
// 문단은 클래스가 없어 기존 동작(캐럿 정상)을 유지한다.
export function createStoryPlaceholder(fallback: string) {
  return Extension.create({
    name: 'storyPlaceholder',
    addProseMirrorPlugins() {
      const editor = this.editor;
      return [
        new Plugin({
          key: storyPlaceholderKey,
          props: {
            decorations: (state) => {
              // showOnlyWhenEditable 대응 — 편집 불가(읽기 전용)면 표시 안 함
              if (!editor.isEditable) return null;
              const { doc } = state;
              const decorations: Decoration[] = [];
              let prevNode: ProseMirrorNode | null = null;
              doc.forEach((node, offset) => {
                const prev = prevNode;
                prevNode = node; // 다음 반복용으로 먼저 갱신
                if (!node.isTextblock || !isNodeEmpty(node)) return;
                // heading 바로 다음 첫 빈 문단만 → 그 섹션 문구. 그 외 빈 문단은 데코 없음.
                if (!prev || prev.type.name !== 'heading') return;

                const heading = prev.textContent.trim();
                const text = STORY_ALL_SECTIONS.find((s) => s.heading === heading)?.prompt ?? fallback;

                decorations.push(
                  Decoration.node(offset, offset + node.nodeSize, {
                    class: 'is-empty',
                    'data-placeholder': text,
                  }),
                );
              });
              return DecorationSet.create(doc, decorations);
            },
          },
        }),
      ];
    },
  });
}
