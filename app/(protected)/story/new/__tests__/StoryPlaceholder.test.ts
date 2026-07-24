import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { createStoryPlaceholder } from '../StoryPlaceholder';
import { STORY_TEMPLATE_HTML, STORY_FORMS } from '@/lib/story/template';

// 커스텀 Placeholder는 뷰포트 윈도잉 없이 매 상태변경마다 전 문서를 스캔한다.
// jsdom은 rect=0이라 스톡도 전체 스캔으로 폴백돼 "스톡 버그 재현"은 불가하지만(주석으로 명기),
// 커스텀이 프리필·재적용 후에도 전 빈 문단에 올바른 문구를 붙이는지는 여기서 결정적으로 검증된다.

function makeEditor(content: string): Editor {
  return new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, createStoryPlaceholder('FALLBACK')],
    content,
  });
}

function placeholders(editor: Editor): string[] {
  return Array.from(editor.view.dom.querySelectorAll('[data-placeholder]')).map(
    (el) => el.getAttribute('data-placeholder') ?? '',
  );
}

const pilgrimage = STORY_FORMS.find((f) => f.key === 'pilgrimage')!;

describe('createStoryPlaceholder — 전 문서 스캔', () => {
  it('프리필: 각 섹션(첫 섹션=옛 도입부 포함) 빈 문단에 각자 문구가 붙는다', () => {
    const editor = makeEditor(STORY_TEMPLATE_HTML);
    const ph = placeholders(editor);
    for (const s of pilgrimage.sections) expect(ph).toContain(s.prompt);
    expect(ph).not.toContain('FALLBACK'); // 전부 매핑됨 — 기본 문구로 뭉개지지 않음
    editor.destroy();
  });

  it('같은 내용 setContent 2회 재적용 후에도 placeholder가 유지된다(증상 B 방어)', () => {
    const editor = makeEditor(STORY_TEMPLATE_HTML);
    editor.commands.setContent(STORY_TEMPLATE_HTML); // 같은 크기 전체 replace
    editor.commands.setContent(STORY_TEMPLATE_HTML);
    const ph = placeholders(editor);
    for (const s of pilgrimage.sections) expect(ph).toContain(s.prompt);
    editor.destroy();
  });

  it('섹션마다 서로 다른 예시가 붙는다', () => {
    const editor = makeEditor(STORY_TEMPLATE_HTML);
    const ph = placeholders(editor);
    const prompts = pilgrimage.sections.map((s) => s.prompt);
    expect(prompts.every((p) => ph.includes(p))).toBe(true);
    expect(new Set(prompts).size).toBe(prompts.length); // 예시들이 실제로 서로 다름
    editor.destroy();
  });
});

describe('안내 반복·겹침 방지 — 자리마다 한 번만', () => {
  const section = pilgrimage.sections.find((s) => s.heading === '그 장면, 그 자리')!;

  it('heading 앞 빈 문단은 문구가 붙지 않는다(도입부 개념 없음)', () => {
    const editor = makeEditor('<p></p><p></p><h2>그 장면, 그 자리</h2><p></p>');
    // heading 앞 빈 문단 2개엔 데코 없음, heading 뒤 첫 빈 문단만
    expect(placeholders(editor)).toEqual([section.prompt]);
    editor.destroy();
  });

  it('heading 다음 빈 문단이 여러 개여도 첫 문단에만 섹션 문구', () => {
    const editor = makeEditor('<h2>그 장면, 그 자리</h2><p></p><p></p>');
    expect(placeholders(editor)).toEqual([section.prompt]); // 둘째 빈 문단은 데코 없음
    editor.destroy();
  });

  it('자유형·빈 본문: 어떤 안내도 띄우지 않는다(문구 없음)', () => {
    const editor = makeEditor('<p></p>');
    expect(placeholders(editor)).toEqual([]);
    editor.destroy();
  });
});
