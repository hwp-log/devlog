import { loginAction } from '../actions';
import { signIn } from '@/lib/auth/actions';
import { redirect } from 'next/navigation';

jest.mock('@/lib/auth/actions', () => ({
  signIn: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

describe('loginAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should redirect to /dashboard on successful login', async () => {
    (signIn as jest.Mock).mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    const formData = new FormData();
    formData.append('email', 'test@test.com');
    formData.append('password', 'password123');
    await loginAction(null, formData);
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });

  it('should return error result when login fails', async () => {
    (signIn as jest.Mock).mockResolvedValueOnce({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });
    const formData = new FormData();
    formData.append('email', 'test@test.com');
    formData.append('password', 'wrongpassword');
    const result = await loginAction(null, formData);
    expect(result).toEqual({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });
    expect(redirect).not.toHaveBeenCalled();
  });
});
