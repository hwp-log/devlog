import { signIn } from '../actions';

// Supabase Mock
const mockSignInWithPassword = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: { signInWithPassword: mockSignInWithPassword },
    })
  ),
}));

describe('signIn', () => {
  // 작업2 : 이메일 형식 검증 실패 시 Supabase 호출 없이 즉시 에러 반환
  it('should return error when email format is invalid', async () => {
    const result = await signIn('not-an-email', 'password123');
    expect(result).toEqual({ error: '이메일 형식이 올바르지 않습니다' });
  });

  // 작업3 : 비밀번호 빈 문자열은 입력 없음으로 간주해 차단
  it('should return error when password is empty', async () => {
    const result = await signIn('user@example.com', '');
    expect(result).toEqual({ error: '비밀번호를 입력해주세요' });
  });

  // 작업4 : Supabase가 인증 실패를 반환하면 통합 에러 메시지로 변환
  it('should return error when supabase auth fails', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });
    const result = await signIn('user@example.com', 'wrongpassword');
    expect(result).toEqual({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });
  });

  // 작업5 : Supabase 인증 성공 시 user 데이터 반환
  it('should return user data when sign in succeeds', async () => {
    const mockUser = { id: 'test-user-id', email: 'user@example.com' };
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: mockUser, session: {} },
      error: null,
    });
    const result = await signIn('user@example.com', 'correctpassword');
    expect(result).toEqual({ data: { user: mockUser } });
  });
});
