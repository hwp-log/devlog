import { render, screen } from '@testing-library/react';
import LoginPage from '../page';

jest.mock('@/lib/auth/actions', () => ({
  signIn: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render email input', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText('이메일')).toBeInTheDocument();
  });

  it('should render password input', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
  });

  it('should render submit button', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument();
  });

  it('should have email input with name="email"', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText('이메일')).toHaveAttribute('name', 'email');
  });

  it('should have password input with name="password"', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('name', 'password');
  });
});
