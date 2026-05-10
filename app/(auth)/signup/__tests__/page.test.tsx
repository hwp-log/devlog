import { render, screen } from '@testing-library/react';
import SignupPage from '../page';

jest.mock('@/lib/auth/actions', () => ({
  signUp: jest.fn(),
}));

describe('SignupPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render 회원가입 heading', () => {
    render(<SignupPage />);
    expect(screen.getByRole('heading', { name: '회원가입' })).toBeInTheDocument();
  });

  it('should render email input', () => {
    render(<SignupPage />);
    expect(screen.getByLabelText('이메일')).toBeInTheDocument();
  });

  it('should render password input', () => {
    render(<SignupPage />);
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
  });

  it('should render password confirm input', () => {
    render(<SignupPage />);
    expect(screen.getByLabelText('비밀번호 확인')).toBeInTheDocument();
  });

  it('should render submit button', () => {
    render(<SignupPage />);
    expect(screen.getByRole('button', { name: '회원가입' })).toBeInTheDocument();
  });
});
