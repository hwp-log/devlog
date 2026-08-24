'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { BTN_SUBMIT } from '@/lib/button-styles';

// 0612: lib/auth/actions.ts signUp의 generic 실패 문구와 동기 — 한쪽만 바꾸면 링크가 안 붙는다.
// 이 문구일 때만 "로그인"을 /login 링크로 분해 렌더 (형식 오류 3종은 문자열 그대로).
const SIGNUP_BLOCKED_ERROR =
  '이 이메일로는 지금 가입할 수 없습니다. 이미 가입하셨다면 로그인해주세요.';

type ActionState = { error: string } | { data: { user: unknown } } | null;
type Strength = '약함' | '보통' | '강함';

interface SignupFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}

function getPasswordStrength(password: string): Strength | null {
  if (password.length === 0) return null;
  if (password.length < 8) return '약함';
  let score = 0;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score >= 2) return '강함';
  if (score >= 1) return '보통';
  return '약함';
}

// 강함 emerald는 토큰 외 예외(0610 확정) — success 축 미존재, PasswordForm 성공 메시지
// 선례 준용. success 축 신설은 색 토큰 정리 사이클에서 경고 축 4종과 함께 판정.
const strengthColor: Record<Strength, string> = {
  약함: 'text-danger',
  보통: 'text-warning',
  강함: 'text-emerald-600',
};

// 0610: 필드·토글은 login/LoginForm.tsx와 동일 리터럴(PasswordForm 정본 준용) — 동기 주의
const inputClass =
  'w-full border border-field-border rounded-lg px-[14px] py-[13px] text-base text-fg2 bg-bg placeholder:text-hint focus:outline-none focus:border-fg/40 transition-colors';

export function SignupForm({ action }: SignupFormProps) {
  const [state, formAction, isPending] = useActionState(action, null);
  // 0613: controlled 3필드 — React 19 form action은 액션 완료 시(성공·실패 무관)
  // uncontrolled 필드를 자동 리셋한다. 실패 후 재입력 부담 + 강도 바 유령(값은 비고
  // state만 잔존) 방지. PasswordForm(mypage) controlled 패턴 준용.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // 0613: 강도는 password state 파생 — 별도 state로 들면 리셋·수정 경로마다 어긋난다(단일 소스+파생)
  const strength = getPasswordStrength(password);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-medium text-muted">
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-medium text-muted">
          비밀번호
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} pr-12`}
          />
          {/* 히트 = input 전체 높이(~48px) × w-12 — §5 44px 충족 */}
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
            className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-muted hover:text-fg2 transition-colors"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <p className="text-xs text-hint">8자 이상 입력해주세요</p>
        {strength && (
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex gap-1">
              <div className={`h-1 w-8 rounded ${strength ? 'bg-danger' : 'bg-fill2'}`} />
              <div className={`h-1 w-8 rounded ${strength === '보통' || strength === '강함' ? 'bg-warning' : 'bg-fill2'}`} />
              <div className={`h-1 w-8 rounded ${strength === '강함' ? 'bg-emerald-500' : 'bg-fill2'}`} />
            </div>
            <span className={`text-xs ${strengthColor[strength]}`}>{strength}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="passwordConfirm" className="text-xs font-medium text-muted">
          비밀번호 확인
        </label>
        <div className="relative">
          <input
            id="passwordConfirm"
            name="passwordConfirm"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            className={`${inputClass} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? '비밀번호 숨기기' : '비밀번호 표시'}
            className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-muted hover:text-fg2 transition-colors"
          >
            {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      {state && 'error' in state && (
        <div role="alert" className="text-sm text-danger break-keep">
          {state.error === SIGNUP_BLOCKED_ERROR ? (
            <>
              {/* 문장 단위 줄바꿈 — 카드 폭 임의 줄바꿈이 둘째 문장을 어중간하게 끊음 */}
              <p>이 이메일로는 지금 가입할 수 없습니다.</p>
              <p>
                이미 가입하셨다면{' '}
                <Link href="/login" className="font-semibold underline">
                  로그인
                </Link>
                해주세요.
              </p>
            </>
          ) : (
            state.error
          )}
        </div>
      )}
      <button type="submit" disabled={isPending} className={`mt-1 ${BTN_SUBMIT}`}>
        {isPending ? '가입 중...' : '회원가입'}
      </button>
    </form>
  );
}
