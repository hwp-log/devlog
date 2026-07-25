import { render, screen, fireEvent } from '@testing-library/react';
import { StoryWriteForm } from '../StoryWriteForm';

// 태그 입력 IME 이중 추가(0366) 재현·방어 — 한글 조합 중 Enter는 keydown이 2회 발생
// (조합 커밋용 isComposing=true + 실제 Enter). 조합 커밋 keydown에서 addTag가 실행되면
// input이 비워진 자리에 IME가 마지막 음절을 커밋해 "수리남"·"남" 2개가 추가된다.
// 무거운 자식(에디터·지도)은 이 테스트 관심사가 아니라 mock.

jest.mock('../TiptapEditor', () => ({ TiptapEditor: () => null }));
jest.mock('@/components/SpotMapWrapper', () => ({ __esModule: true, default: () => null }));

const noopAction = async () => null;

function setupTagInput() {
  render(<StoryWriteForm action={noopAction} userId="u1" />);
  return screen.getByPlaceholderText('태그 입력 후 Enter') as HTMLInputElement;
}

describe('태그 입력 — IME 조합 Enter 방어', () => {
  it('조합 중 Enter(isComposing=true)는 무시된다 — 태그 미추가·입력값 유지', () => {
    const input = setupTagInput();
    fireEvent.change(input, { target: { value: '수리남' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(screen.queryByText(/#수리남/)).not.toBeInTheDocument();
    expect(input.value).toBe('수리남');
  });

  it('조합 커밋 후 실제 Enter에서 한 번만 추가된다(IME 시퀀스 재현)', () => {
    const input = setupTagInput();
    fireEvent.change(input, { target: { value: '수리남' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true }); // 조합 커밋 keydown
    fireEvent.keyDown(input, { key: 'Enter' }); // 실제 Enter
    expect(screen.getByText(/#수리남/)).toBeInTheDocument();
    expect(screen.queryByText(/^#남$/)).not.toBeInTheDocument();
    expect(input.value).toBe('');
  });

  it('영어(비IME) Enter는 기존대로 즉시 추가된다 — 회귀 없음', () => {
    const input = setupTagInput();
    fireEvent.change(input, { target: { value: 'seoul' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText(/#seoul/)).toBeInTheDocument();
    expect(input.value).toBe('');
  });
});
