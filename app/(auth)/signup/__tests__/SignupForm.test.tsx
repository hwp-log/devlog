import { act, render, screen, fireEvent } from '@testing-library/react';
import { SignupForm } from '../SignupForm';

const mockAction = jest.fn().mockResolvedValue(null);

describe('SignupForm', () => {
  it('should render email input', () => {
    render(<SignupForm action={mockAction} />);
    expect(screen.getByLabelText('이메일')).toBeInTheDocument();
  });

  it('should render password input', () => {
    render(<SignupForm action={mockAction} />);
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
  });

  it('should render password confirm input', () => {
    render(<SignupForm action={mockAction} />);
    expect(screen.getByLabelText('비밀번호 확인')).toBeInTheDocument();
  });

  it('should render submit button', () => {
    render(<SignupForm action={mockAction} />);
    expect(screen.getByRole('button', { name: '회원가입' })).toBeInTheDocument();
  });

  it('should not show error message initially', () => {
    render(<SignupForm action={mockAction} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should call action when form is submitted', async () => {
    const localMock = jest.fn().mockResolvedValue(null);
    render(<SignupForm action={localMock} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
    });
    expect(localMock).toHaveBeenCalled();
  });

  it('should show error message when action returns error', async () => {
    const errorAction = jest.fn().mockResolvedValue({ error: '이메일 형식이 올바르지 않습니다' });
    render(<SignupForm action={errorAction} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('이메일 형식이 올바르지 않습니다');
  });

  it('should show minimum length hint under password input', () => {
    render(<SignupForm action={mockAction} />);
    expect(screen.getByText('8자 이상 입력해주세요')).toBeInTheDocument();
  });

  it('should not show strength indicator initially', () => {
    render(<SignupForm action={mockAction} />);
    expect(screen.queryByText('약함')).not.toBeInTheDocument();
    expect(screen.queryByText('보통')).not.toBeInTheDocument();
    expect(screen.queryByText('강함')).not.toBeInTheDocument();
  });

  it('should show 약함 when password is short', async () => {
    render(<SignupForm action={mockAction} />);
    await act(async () => {
      fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'abc' } });
    });
    expect(screen.getByText('약함')).toBeInTheDocument();
  });

  it('should show 보통 when password has length and some variety', async () => {
    render(<SignupForm action={mockAction} />);
    await act(async () => {
      fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'password1' } });
    });
    expect(screen.getByText('보통')).toBeInTheDocument();
  });

  it('should show 강함 when password has high variety', async () => {
    render(<SignupForm action={mockAction} />);
    await act(async () => {
      fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'Password1!' } });
    });
    expect(screen.getByText('강함')).toBeInTheDocument();
  });
});
