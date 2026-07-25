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

// 커스텀 Placeholder. 매 상태변경마다 top-level을 훑어 두 자리에만 data-placeholder + is-empty를 붙인다:
// ① "heading 바로 다음에 오는 첫 빈 문단" → 섹션 문구(예: …). 도입부는 각 양식의 첫 섹션이라 특수 분기 없음.
// ② "문서 맨 끝 빈 문단(heading 직후 아님)" → 슬래시 안내(SLASH_HINT). 슬래시 명령 발견성(0333 동기)을
//    본문 안에서 해결. heading 직후면 ①이 이긴다 — 프리필 새 글의 끝(h2+빈 문단)은 섹션 문구 유지.
// 그 외 빈 문단(중간 빈 줄)엔 안 붙임 → 엔터로 생긴 빈 줄에 안내가 반복·겹치지 않음.
// 0336 "자유형·빈 본문 무안내"는 *내용* 간섭 배제의 뜻 — 슬래시 안내는 도구 사용법이라 예외로 빈
// 본문 단독 문단에도 표시한다(사용자 확정).
// is-empty가 "문구 붙는 문단"에만 있으므로 CSS는 그 문단만 block 처리하면 되고, 안 붙는 빈
// 문단은 클래스가 없어 기존 동작(캐럿 정상)을 유지한다.

export const SLASH_HINT = "'/' 를 입력해 블록을 추가하세요";

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

                if (prev && prev.type.name === 'heading') {
                  // ① heading 바로 다음 첫 빈 문단 → 그 섹션 문구 (마지막 노드여도 이 분기가 우선)
                  const heading = prev.textContent.trim();
                  const text =
                    STORY_ALL_SECTIONS.find((s) => s.heading === heading)?.prompt ?? fallback;
                  decorations.push(
                    Decoration.node(offset, offset + node.nodeSize, {
                      class: 'is-empty',
                      'data-placeholder': text,
                    }),
                  );
                  return;
                }

                // ② 문서 맨 끝 빈 문단(문단 한정 — 빈 heading 제외) → 슬래시 안내
                const isLast = offset + node.nodeSize === doc.content.size;
                if (isLast && node.type.name === 'paragraph') {
                  decorations.push(
                    Decoration.node(offset, offset + node.nodeSize, {
                      class: 'is-empty',
                      'data-placeholder': SLASH_HINT,
                    }),
                  );
                }
              });
              return DecorationSet.create(doc, decorations);
            },
          },
        }),
      ];
    },
  });
}
