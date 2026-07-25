import { Node, mergeAttributes } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

// 콜아웃 블록 — 양식 5종 개편 선행(프리필 💡팁/❓FAQ 전제).
// 저장 HTML: <div data-callout="tip|faq|warn"><p>제목</p><p>본문…</p></div>
// 규약: 첫 문단 = 제목(내용으로 치지 않음 — heading 구간 규칙과 동일 철학, clean-empty-sections 짝),
//       FAQ만 2번째 문단 = 질문. 역할은 문단 위치가 결정하고 스타일은 globals.css nth-child가 담당.
// 이모지는 데이터에 없음 — data-callout 값에서 CSS ::before로 파생(문서 텍스트 비오염).

export type CalloutKind = 'tip' | 'faq' | 'warn';

const KINDS: readonly string[] = ['tip', 'faq', 'warn'];

// 삽입 시 기본 제목(사용자 수정 자유). 시안 어휘 — 이모지 금지
const DEFAULT_TITLES: Record<CalloutKind, string> = {
  tip: '팁',
  faq: '자주 묻는 질문',
  warn: '주의',
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      /** 콜아웃 삽입 — 제목 문단 + 빈 본문(FAQ는 질문·답변 2개), 커서는 첫 빈 문단 */
      insertCallout: (kind: CalloutKind) => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'paragraph+', // 이미지·heading 진입 불가 — 썸네일 추출·구간 분할에 구조적 무영향
  defining: true, // 붙여넣기·교체 시 구조 보존
  isolating: true, // 경계 밖 병합(Backspace로 콜아웃 해체) 방지

  addAttributes() {
    return {
      kind: {
        default: 'tip',
        // 화이트리스트 검증 — 저장 값은 항상 3종 리터럴(외부 HTML 붙여넣기 방어)
        parseHTML: (el) => {
          const v = el.getAttribute('data-callout');
          return v && KINDS.includes(v) ? v : 'tip';
        },
        renderHTML: (attrs) => ({ 'data-callout': attrs.kind }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      insertCallout:
        (kind) =>
        ({ chain, state }) => {
          // 콜아웃 안에서 재삽입 금지 — 스키마상 중첩 불가라 분열 삽입되는 것을 차단
          const { $from } = state.selection;
          for (let d = $from.depth; d > 0; d--) {
            if ($from.node(d).type.name === this.name) return false;
          }
          const c = chain().insertContent({
            type: this.name,
            attrs: { kind },
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: DEFAULT_TITLES[kind] }] },
              { type: 'paragraph' },
              ...(kind === 'faq' ? [{ type: 'paragraph' }] : []),
            ],
          });
          if (kind === 'faq') {
            // insertContent 후 커서는 마지막 문단(답변) — 질문(직전 형제 빈 문단)으로 이동
            c.command(({ tr }) => {
              const answerStart = tr.selection.$from.before();
              tr.setSelection(TextSelection.create(tr.doc, answerStart - 1));
              return true;
            });
          }
          return c.run();
        },
    };
  },
});
