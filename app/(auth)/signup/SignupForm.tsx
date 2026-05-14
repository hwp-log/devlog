'use client';
import { useActionState, useState } from 'react';

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

const strengthColor: Record<Strength, string> = {
  약함: 'text-red-500',
  보통: 'text-yellow-500',
  강함: 'text-green-600',
};

export function SignupForm({ action }: SignupFormProps) {
  const [state, formAction] = useActionState(action, null);
  const [strength, setStrength] = useState<Strength | null>(null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-slate-600">
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-slate-600">
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          onChange={(e) => setStrength(getPasswordStrength(e.target.value))}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        <p className="text-xs text-slate-400">8자 이상 입력해주세요</p>
        {strength && (
          <div className="flex items-center gap-2 mt-1">
            <div className="flex gap-1">
              <div className={`h-1 w-8 rounded ${strength ? 'bg-red-400' : 'bg-slate-200'}`} />
              <div className={`h-1 w-8 rounded ${strength === '보통' || strength === '강함' ? 'bg-yellow-400' : 'bg-slate-200'}`} />
              <div className={`h-1 w-8 rounded ${strength === '강함' ? 'bg-green-500' : 'bg-slate-200'}`} />
            </div>
            <span className={`text-xs ${strengthColor[strength]}`}>{strength}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="passwordConfirm" className="text-sm font-medium text-slate-600">
          비밀번호 확인
        </label>
        <input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>
      {state && 'error' in state && (
        <p role="alert" className="text-sm text-red-600">{state.error}</p>
      )}
      <button
        type="submit"
        className="mt-2 bg-slate-800 text-white rounded-lg py-2 text-sm font-medium hover:bg-slate-700 transition-colors"
      >
        회원가입
      </button>
    </form>
  );
}
