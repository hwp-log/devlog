import { signupAction } from '../actions';
import { signUp } from '@/lib/auth/actions';
import { redirect } from 'next/navigation';

jest.mock('@/lib/auth/actions', () => ({
  signUp: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

describe('signupAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call signUp with email/password/passwordConfirm from FormData', async () => {
    (signUp as jest.Mock).mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    const formData = new FormData();
    formData.append('email', 'user@example.com');
    formData.append('password', 'password123');
    formData.append('passwordConfirm', 'password123');
    await signupAction(null, formData);
    expect(signUp).toHaveBeenCalledWith('user@example.com', 'password123', 'password123');
  });

  it('should return error result when signUp fails', async () => {
    (signUp as jest.Mock).mockResolvedValueOnce({ error: '회원가입에 실패했습니다' });
    const formData = new FormData();
    formData.append('email', 'user@example.com');
    formData.append('password', 'password123');
    formData.append('passwordConfirm', 'password123');
    const result = await signupAction(null, formData);
    expect(result).toEqual({ error: '회원가입에 실패했습니다' });
  });

  it('should redirect to /login on successful signup', async () => {
    (signUp as jest.Mock).mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    const formData = new FormData();
    formData.append('email', 'user@example.com');
    formData.append('password', 'password123');
    formData.append('passwordConfirm', 'password123');
    await signupAction(null, formData);
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('should not redirect when signup fails', async () => {
    (signUp as jest.Mock).mockResolvedValueOnce({ error: '회원가입에 실패했습니다' });
    const formData = new FormData();
    formData.append('email', 'user@example.com');
    formData.append('password', 'password123');
    formData.append('passwordConfirm', 'password123');
    await signupAction(null, formData);
    expect(redirect).not.toHaveBeenCalled();
  });
});
