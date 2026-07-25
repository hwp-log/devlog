import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { createStoryPlaceholder, SLASH_HINT } from '../StoryPlaceholder';
import { Callout } from '../Callout';
import { STORY_TEMPLATE_HTML, STORY_FORMS, STORY_ALL_SECTIONS } from '@/lib/story/template';

// 커스텀 Placeholder는 뷰포트 윈도잉 없이 매 상태변경마다 전 문서를 스캔한다.
// jsdom은 rect=0이라 스톡도 전체 스캔으로 폴백돼 "스톡 버그 재현"은 불가하지만(주석으로 명기),
// 빈 문단에 올바른 문구를 붙이는지는 여기서 결정적으로 검증된다.
// 0355 과도기: 프리필이 실제 텍스트가 되어 새 글에는 섹션 문구가 안 뜨고, 사용자가 섹션 본문을
// 비웠을 때만 뜬다 — 빈 골격은 테스트가 직접 구성한다. StoryPlaceholder 제거(다음 커밋)까지 유지.

function makeEditor(content: string): Editor {
  return new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, Callout, createStoryPlaceholder('FALLBACK')],
    content,
  });
}

function placeholders(editor: Editor): string[] {
  return Array.from(editor.view.dom.querySelectorAll('[data-placeholder]')).map(
    (el) => el.getAttribute('data-placeholder') ?? '',
  );
}

const pilgrimage = STORY_FORMS.find((f) => f.key === 'pilgrimage')!;
const promptOf = (heading: string) =>
  STORY_ALL_SECTIONS.find((s) => s.heading === heading)!.prompt;
// 사용자가 예시 본문을 지운 상태의 빈 골격(h2 + 빈 문단)
const EMPTY_SKELETON = pilgrimage.sections
  .map((s) => `<h2>${s.heading}</h2><p></p>`)
  .join('');

describe('createStoryPlaceholder — 전 문서 스캔', () => {
  it('본문을 비운 골격: 각 heading 뒤 빈 문단에 각자 문구가 붙는다', () => {
    const editor = makeEditor(EMPTY_SKELETON);
    const ph = placeholders(editor);
    for (const s of pilgrimage.sections) expect(ph).toContain(promptOf(s.heading));
    expect(ph).not.toContain('FALLBACK'); // 전부 매핑됨 — 기본 문구로 뭉개지지 않음
    editor.destroy();
  });

  it('같은 내용 setContent 2회 재적용 후에도 placeholder가 유지된다(증상 B 방어)', () => {
    const editor = makeEditor(EMPTY_SKELETON);
    editor.commands.setContent(EMPTY_SKELETON); // 같은 크기 전체 replace
    editor.commands.setContent(EMPTY_SKELETON);
    const ph = placeholders(editor);
    for (const s of pilgrimage.sections) expect(ph).toContain(promptOf(s.heading));
    editor.destroy();
  });

  it('섹션마다 서로 다른 예시가 붙는다', () => {
    const editor = makeEditor(EMPTY_SKELETON);
    const ph = placeholders(editor);
    const prompts = pilgrimage.sections.map((s) => promptOf(s.heading));
    expect(prompts.every((p) => ph.includes(p))).toBe(true);
    expect(new Set(prompts).size).toBe(prompts.length); // 예시들이 실제로 서로 다름
    editor.destroy();
  });
});

describe('안내 반복·겹침 방지 — 자리마다 한 번만', () => {
  const sectionPrompt = promptOf('그 장면, 그 자리');

  it('heading 앞 빈 문단은 문구가 붙지 않는다(도입부 개념 없음)', () => {
    const editor = makeEditor('<p></p><p></p><h2>그 장면, 그 자리</h2><p></p>');
    // heading 앞 빈 문단 2개엔 데코 없음, heading 뒤 첫 빈 문단만
    expect(placeholders(editor)).toEqual([sectionPrompt]);
    editor.destroy();
  });

  it('heading 다음 빈 문단이 여러 개여도 섹션 문구는 첫 문단에만', () => {
    const editor = makeEditor('<h2>그 장면, 그 자리</h2><p></p><p></p>');
    // 둘째 빈 문단은 문서 맨 끝이라 슬래시 안내(끝 안내 도입으로 기대값 갱신) —
    // 섹션 문구가 첫 문단에만 붙는다는 겹침 방지 검증은 그대로 유지
    expect(placeholders(editor)).toEqual([sectionPrompt, SLASH_HINT]);
    editor.destroy();
  });

  it('자유형·빈 본문: 섹션 내용 안내는 없고 슬래시 안내(도구 사용법)만 뜬다', () => {
    // 0336 "무안내"는 내용 간섭 배제의 뜻 — 도구 안내는 예외(사용자 확정으로 기대값 갱신).
    const editor = makeEditor('<p></p>');
    const ph = placeholders(editor);
    expect(ph).toEqual([SLASH_HINT]);
    // 내용 무안내 검증 존속: 섹션 예시·기본 문구가 섞여 들지 않음
    expect(ph).not.toContain('FALLBACK');
    for (const s of pilgrimage.sections) expect(ph).not.toContain(promptOf(s.heading));
    editor.destroy();
  });
});

describe('맨 끝 빈 문단 슬래시 안내', () => {
  const sectionPrompt = promptOf('그 장면, 그 자리');

  it('내용 있는 문서의 끝 빈 문단에 슬래시 안내가 붙는다', () => {
    const editor = makeEditor('<p>내용</p><p></p>');
    expect(placeholders(editor)).toEqual([SLASH_HINT]);
    editor.destroy();
  });

  it('끝이 비어있지 않으면 슬래시 안내가 뜨지 않는다(수정 화면 시나리오)', () => {
    const editor = makeEditor('<h2>그 장면, 그 자리</h2><p></p><p>텍스트</p>');
    expect(placeholders(editor)).toEqual([sectionPrompt]);
    editor.destroy();
  });

  it('마지막 노드가 빈 heading이면 슬래시 안내가 뜨지 않는다(문단 한정)', () => {
    const editor = makeEditor('<p>내용</p><h2></h2>');
    expect(placeholders(editor)).toEqual([]);
    editor.destroy();
  });

  it('프리필(실제 텍스트): 섹션 문구는 없고 끝 빈 문단에 슬래시 안내만 붙는다', () => {
    // 0355: 예시가 진짜 글자라 빈 문단은 tail 뒤 끝 빈 문단 하나뿐(콜아웃 뒤 = heading 직후 아님)
    const editor = makeEditor(STORY_TEMPLATE_HTML);
    expect(placeholders(editor)).toEqual([SLASH_HINT]);
    editor.destroy();
  });
});
