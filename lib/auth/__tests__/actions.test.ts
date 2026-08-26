// 1. import 추가 — signUp을 actions.ts에서 가져옴
import { signIn, signUp } from '../actions';

// ** Supabase Mock **
const mockSignInWithPassword = jest.fn();
// 2. mockSignUp 추가 — signUp 호출을 가로챌 mock 함수
const mockSignUp = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      // 3. auth 객체에 signUp 추가 (signInWithPassword와 같은 위치)
      auth: {
        signInWithPassword: mockSignInWithPassword,
        signUp: mockSignUp,
      },
    })
  ),
}));
// 0017 테스트
describe('signIn', () => {
  // 이메일 형식 검증 실패 시 Supabase 호출 없이 즉시 에러 반환
  it('should return error when email format is invalid', async () => {
    const result = await signIn('not-an-email', 'password123');
    expect(result).toEqual({ error: '이메일 형식이 올바르지 않습니다' });
  });

  // 비밀번호 빈 문자열은 입력 없음으로 간주해 차단
  it('should return error when password is empty', async () => {
    const result = await signIn('user@example.com', '');
    expect(result).toEqual({ error: '비밀번호를 입력해주세요' });
  });

  // Supabase가 인증 실패를 반환하면 통합 에러 메시지로 변환
  it('should return error when supabase auth fails', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });
    const result = await signIn('user@example.com', 'wrongpassword');
    expect(result).toEqual({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });
  });

  // Supabase 인증 성공 시 user 데이터 반환
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
// 0018 테스트
describe('signUp', () => {
  // 작업1 : 이메일 형식 검증 실패 시 Supabase 호출 없이 즉시 에러 반환
  it('should return error when email format is invalid', async () => {
    const result = await signUp('not-an-email', 'password123', 'password123');
    expect(result).toEqual({ error: '이메일 형식이 올바르지 않습니다' });
  });

  // 작업2 : 비밀번호가 8자 미만이면 즉시 에러 반환
  it('should return error when password is too short', async () => {
    const result = await signUp('user@example.com', '1234567', '1234567');
    expect(result).toEqual({ error: '비밀번호는 8자 이상이어야 합니다' });
  });

  // 작업3 : 비밀번호와 비밀번호 확인이 다르면 즉시 에러 반환
  it('should return error when passwords do not match', async () => {
    const result = await signUp('user@example.com', 'password123', 'different123');
    expect(result).toEqual({ error: '비밀번호가 일치하지 않습니다' });
  });

  // 작업4 : Supabase가 회원가입 실패를 반환하면 통합 에러 메시지로 변환
  it('should return error when supabase signup fails', async () => {
    // 1. mock 셋업
    mockSignUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    });
    // 2. 함수 호출
    const result = await signUp('user@example.com', 'password123', 'password123');
    // 3. 기대값 검증
    expect(result).toEqual({ error: '이 이메일로는 지금 가입할 수 없습니다. 이미 가입하셨다면 로그인해주세요.' });
  });

  // 작업5 : Supabase 회원가입 성공 시 user 데이터 반환
  it('should return user data when signup succeeds', async () => {
    const mockUser = { id: 'new-user-id', email: 'user@example.com' };
    mockSignUp.mockResolvedValueOnce({
      data: { user: mockUser, session: null },
      error: null,
    });
    const result = await signUp('user@example.com', 'password123', 'password123');
    expect(result).toEqual({ data: { user: mockUser } });
  });
});
