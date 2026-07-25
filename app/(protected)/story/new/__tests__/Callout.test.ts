import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { NodeSelection } from '@tiptap/pm/state';
import { Callout } from '../Callout';

// 콜아웃 경계 삭제(0363) — isolating 유지 + addKeyboardShortcuts 2단 삭제 검증.
// 키 입력은 view.someProp('handleKeyDown') 경유 — 우리 keymap과 코어 Keymap 모두 지나므로
// 레이아웃 불요 범위에서 실제 키 경로와 동일하게 검증된다(시각 하이라이트·터치는 실브라우저 항목).

const WITH_CONTENT =
  '<p>앞</p><div data-callout="tip"><p>팁</p><p>본문</p></div><p>뒤</p>';
const EMPTY_CALLOUT = '<p>앞</p><div data-callout="tip"><p></p><p></p></div><p>뒤</p>';

function makeEditor(content: string) {
  return new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, Callout],
    content,
  });
}

function press(editor: Editor, key: string): boolean {
  const ev = new KeyboardEvent('keydown', { key });
  return editor.view.someProp('handleKeyDown', (f) => f(editor.view, ev)) ?? false;
}

function calloutPos(editor: Editor): number {
  let pos = -1;
  editor.state.doc.forEach((node, offset) => {
    if (node.type.name === 'callout') pos = offset;
  });
  return pos;
}

const hasCallout = (editor: Editor) => calloutPos(editor) !== -1;

describe('콜아웃 경계 삭제 — 빈 콜아웃', () => {
  it('첫 문단 맨 앞 Backspace 1회로 통삭제된다', () => {
    const editor = makeEditor(EMPTY_CALLOUT);
    editor.commands.setTextSelection(calloutPos(editor) + 2); // 첫 textblock 시작
    expect(press(editor, 'Backspace')).toBe(true);
    expect(hasCallout(editor)).toBe(false);
    expect(editor.getHTML()).toContain('<p>앞</p>');
    expect(editor.getHTML()).toContain('<p>뒤</p>'); // 이웃 블록 무손상
    editor.destroy();
  });

  it('마지막 문단 맨 끝 Delete 1회로 통삭제된다(대칭)', () => {
    const editor = makeEditor(EMPTY_CALLOUT);
    const pos = calloutPos(editor);
    const node = editor.state.doc.nodeAt(pos)!;
    editor.commands.setTextSelection(pos + node.nodeSize - 2); // 마지막 textblock 끝
    expect(press(editor, 'Delete')).toBe(true);
    expect(hasCallout(editor)).toBe(false);
    editor.destroy();
  });
});

describe('콜아웃 경계 삭제 — 내용 있는 콜아웃(2단)', () => {
  it('첫 문단 맨 앞 Backspace 1회차: 노드 선택만 되고 문서는 불변', () => {
    const editor = makeEditor(WITH_CONTENT);
    const before = editor.getHTML();
    editor.commands.setTextSelection(calloutPos(editor) + 2);
    expect(press(editor, 'Backspace')).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect((editor.state.selection as NodeSelection).node.type.name).toBe('callout');
    expect(editor.getHTML()).toBe(before);
    editor.destroy();
  });

  it('2회차 Backspace: 선택된 콜아웃이 통삭제된다', () => {
    const editor = makeEditor(WITH_CONTENT);
    editor.commands.setTextSelection(calloutPos(editor) + 2);
    press(editor, 'Backspace'); // 1회차 — NodeSelection
    press(editor, 'Backspace'); // 2회차 — 기본 deleteSelection
    expect(hasCallout(editor)).toBe(false);
    expect(editor.getHTML()).toContain('<p>앞</p>');
    expect(editor.getHTML()).toContain('<p>뒤</p>');
    editor.destroy();
  });

  it('마지막 문단 맨 끝 Delete 1회차: 노드 선택(대칭)', () => {
    const editor = makeEditor(WITH_CONTENT);
    const pos = calloutPos(editor);
    const node = editor.state.doc.nodeAt(pos)!;
    editor.commands.setTextSelection(pos + node.nodeSize - 2);
    expect(press(editor, 'Delete')).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    editor.destroy();
  });

  it('undo 1회로 통삭제가 복원된다', () => {
    const editor = makeEditor(WITH_CONTENT);
    const before = editor.getHTML();
    editor.commands.setTextSelection(calloutPos(editor) + 2);
    press(editor, 'Backspace');
    press(editor, 'Backspace');
    expect(hasCallout(editor)).toBe(false);
    editor.commands.undo();
    expect(editor.getHTML()).toBe(before);
    editor.destroy();
  });
});

describe('기본 동작 무간섭', () => {
  it('내부 문단 사이 Backspace는 정상 병합되고 콜아웃은 유지된다', () => {
    const editor = makeEditor(WITH_CONTENT);
    // 두 번째 문단('본문') 시작 = callout+2(첫 p 열림) + '팁'.length + 2(첫 p 닫힘+둘째 p 열림)
    editor.commands.setTextSelection(calloutPos(editor) + 2 + 1 + 2);
    press(editor, 'Backspace');
    expect(hasCallout(editor)).toBe(true);
    expect(editor.getHTML()).toContain('<p>팁본문</p>'); // 내부 join은 경계가 아님 — 허용 유지
    editor.destroy();
  });

  it('콜아웃 밖 문단의 Backspace에는 개입하지 않는다(핸들러 미처리 → 브라우저 위임)', () => {
    // 일반 글자 삭제는 PM keymap이 아닌 브라우저 네이티브 편집 소관 — jsdom에선 글자가
    // 안 지워지는 게 정상이므로 "keydown 미처리(false) + 문서 불변"이 올바른 불개입 검증.
    const editor = makeEditor(WITH_CONTENT);
    const before = editor.getHTML();
    editor.commands.setTextSelection(editor.state.doc.content.size - 1); // '뒤' 끝
    expect(press(editor, 'Backspace')).toBe(false);
    expect(editor.getHTML()).toBe(before);
    expect(hasCallout(editor)).toBe(true);
    editor.destroy();
  });
});
