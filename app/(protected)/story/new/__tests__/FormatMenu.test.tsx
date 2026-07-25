import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { FormatMenu } from '../FormatMenu';
import { Callout } from '../Callout';
import { STORY_TEMPLATE_HTML } from '@/lib/story/template';

// 0359 확인 분기 UI — 교체는 항상 전체 교체, 쓴 내용이 있을 때만 팝오버가 확인 화면으로 전환.
// jsdom엔 ResizeObserver가 없어(@floating-ui autoUpdate 의존) 최소 스텁을 주입한다.

beforeAll(() => {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

function makeEditor(content: string): Editor {
  return new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, Image, Callout],
    content,
  });
}

// 예시 원문에서 한 글자 수정 — "쓴 내용 있음" 픽스처
const EDITED_HTML = STORY_TEMPLATE_HTML.replace('출입 제한이다', '출입 제한이었다');

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: /서식/ }));
}

describe('FormatMenu — 확인 분기', () => {
  it('예시 원문 그대로면 확인 없이 즉시 전체 교체되고 팝오버가 닫힌다', () => {
    const editor = makeEditor(STORY_TEMPLATE_HTML);
    render(<FormatMenu editor={editor} />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /정보 리뷰형/ }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); // 확인 화면 없음
    expect(screen.queryByRole('menu')).not.toBeInTheDocument(); // 닫힘
    expect(editor.getHTML()).toContain('<h2>다녀온 곳</h2>');
    expect(editor.getHTML()).not.toContain('작품과 장소');
    editor.destroy();
  });

  it('빈 본문이어도 확인 없이 즉시 교체된다', () => {
    const editor = makeEditor('<p></p>');
    render(<FormatMenu editor={editor} />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /에세이형/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(editor.getHTML()).toContain('<h2>여행의 시작</h2>');
    editor.destroy();
  });

  it('쓴 내용이 있으면 확인 화면으로 전환되고 본문은 그대로다 — 포커스는 취소 버튼', async () => {
    const editor = makeEditor(EDITED_HTML);
    const before = editor.getHTML();
    render(<FormatMenu editor={editor} />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /에세이형/ }));

    expect(screen.getByRole('dialog', { name: '양식 바꾸기' })).toBeInTheDocument();
    expect(screen.getByText('에세이형으로 바꿀까요?')).toBeInTheDocument();
    expect(screen.getByText('지금 쓴 내용은 사라져요.')).toBeInTheDocument();
    expect(screen.queryByText(/Ctrl\+Z/)).not.toBeInTheDocument(); // 되돌리기 약속 없음(모바일 거짓)
    expect(editor.getHTML()).toBe(before); // 확인 전 본문 불변
    // 파괴적 확인의 기본 포커스는 안전한 쪽(취소)
    await waitFor(() => expect(screen.getByRole('button', { name: '취소' })).toHaveFocus());
    editor.destroy();
  });

  it('취소하면 목록으로 복귀하고 본문은 그대로다', () => {
    const editor = makeEditor(EDITED_HTML);
    const before = editor.getHTML();
    render(<FormatMenu editor={editor} />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /에세이형/ }));
    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(screen.getByRole('menu')).toBeInTheDocument(); // 목록 복귀(팝오버 유지)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(editor.getHTML()).toBe(before);
    editor.destroy();
  });

  it('확인 화면 ESC는 취소와 같다 — 목록 복귀, 팝오버는 닫히지 않는다', () => {
    const editor = makeEditor(EDITED_HTML);
    render(<FormatMenu editor={editor} />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /에세이형/ }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(editor.getHTML()).toContain('출입 제한이었다'); // 본문 불변
    editor.destroy();
  });

  it('바꾸기를 누르면 전체 교체 후 닫히고, undo 1회로 교체 전으로 복원된다', () => {
    const editor = makeEditor(EDITED_HTML);
    const before = editor.getHTML();
    render(<FormatMenu editor={editor} />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /에세이형/ }));
    fireEvent.click(screen.getByRole('button', { name: '바꾸기' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument(); // 팝오버 닫힘
    expect(editor.getHTML()).toContain('<h2>여행의 시작</h2>'); // 전체 교체
    expect(editor.getHTML()).not.toContain('출입 제한이었다');
    editor.commands.undo(); // 단일 트랜잭션 — 한 번에 복원
    expect(editor.getHTML()).toBe(before);
    editor.destroy();
  });

  it('자유형 선택 + 내용 있음: 확인 후 바꾸면 빈 본문이 된다', () => {
    const editor = makeEditor(EDITED_HTML);
    render(<FormatMenu editor={editor} />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /자유형/ }));
    expect(screen.getByText('자유형으로 바꿀까요?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '바꾸기' }));
    expect(editor.getHTML()).toBe('<p></p>'); // 완전히 빈 본문
    editor.destroy();
  });
});
