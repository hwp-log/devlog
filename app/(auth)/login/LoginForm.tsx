'use client';
import { useActionState, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { BTN_SUBMIT } from '@/lib/button-styles';

type ActionState = { error: string } | { data: { user: unknown } } | null;

interface LoginFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}

// 0609: 필드 클래스는 mypage/PasswordForm.tsx inputClass 준용(토큰 필드 정본) —
// text-base(16px)는 iOS 자동확대 방지(§5) 겸용. 토글 자리만 pr-12 덧붙임.
const inputClass =
  'w-full border border-field-border rounded-lg px-[14px] py-[13px] text-base text-fg2 bg-bg placeholder:text-hint focus:outline-none focus:border-fg/40 transition-colors';

export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(action, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-medium text-muted">
          이메일
        </label>
        <input id="email" name="email" type="email" autoComplete="email" className={inputClass} />
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
            autoComplete="current-password"
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
      </div>
      {state && 'error' in state && (
        <p role="alert" className="text-sm text-danger">{state.error}</p>
      )}
      <button type="submit" disabled={isPending} className={`mt-1 ${BTN_SUBMIT}`}>
        {isPending ? '로그인 중...' : '로그인'}
      </button>
    </form>
  );
}
