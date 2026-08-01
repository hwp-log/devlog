import { Mark, mergeAttributes } from '@tiptap/core';

// "작게" 마크 — 저장 HTML: <span data-size="sm">…</span>
// 크기 값은 sm 하나만(자유 크기 금지 — 글 간 리듬 보호, 크게는 헤딩 h2/h3 소관).
// 인라인 style 금지: 저장 HTML을 sanitize 없이 dangerouslySetInnerHTML로 렌더하는
// 구조라 style 개방은 위험 — Callout data-callout과 같은
// "속성 화이트리스트 + CSS 파생(globals.css [data-size='sm'])" 방식.

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    size: {
      /** "작게" 마크 토글 — 캡션·부연용 보조 크기(13px, globals.css 파생) */
      toggleSmall: () => ReturnType;
    };
  }
}

export const SizeMark = Mark.create({
  name: 'size',

  addAttributes() {
    return {
      size: {
        default: 'sm',
        // 화이트리스트 검증 — sm 외 값은 미파싱(외부 HTML 붙여넣기 방어, Callout kind 선례)
        parseHTML: (el) => (el.getAttribute('data-size') === 'sm' ? 'sm' : null),
        renderHTML: (attrs) => ({ 'data-size': attrs.size }),
      },
    };
  },

  // 태그 셀렉터 자체를 sm으로 한정 — 일반 span·타 값 span은 마크로 안 잡힘
  parseHTML() {
    return [{ tag: 'span[data-size="sm"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      toggleSmall:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name, { size: 'sm' }),
    };
  },
});
