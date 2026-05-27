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
  const [state, formAction, isPending] = useActionState(action, null);
  const [strength, setStrength] = useState<Strength | null>(null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-[#1A1A1A]">
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="w-full border-[0.5px] border-black/15 rounded-[10px] px-[14px] py-3 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:border-black/40 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.08)] transition-all"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-[#1A1A1A]">
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          onChange={(e) => setStrength(getPasswordStrength(e.target.value))}
          className="w-full border-[0.5px] border-black/15 rounded-[10px] px-[14px] py-3 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:border-black/40 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.08)] transition-all"
        />
        <p className="text-xs text-slate-400">8자 이상 입력해주세요</p>
        {strength && (
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex gap-1">
              <div className={`h-1 w-8 rounded ${strength ? 'bg-red-400' : 'bg-slate-200'}`} />
              <div className={`h-1 w-8 rounded ${strength === '보통' || strength === '강함' ? 'bg-yellow-400' : 'bg-slate-200'}`} />
              <div className={`h-1 w-8 rounded ${strength === '강함' ? 'bg-green-500' : 'bg-slate-200'}`} />
            </div>
            <span className={`text-xs ${strengthColor[strength]}`}>{strength}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="passwordConfirm" className="text-sm font-medium text-[#1A1A1A]">
          비밀번호 확인
        </label>
        <input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          className="w-full border-[0.5px] border-black/15 rounded-[10px] px-[14px] py-3 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:border-black/40 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.08)] transition-all"
        />
      </div>
      {state && 'error' in state && (
        <p role="alert" className="text-sm text-red-600">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full mt-1 bg-[#1A1A1A] text-white rounded-full py-[13px] text-sm font-semibold hover:bg-[#333] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? 'Signing up...' : 'Sign Up'}
      </button>
    </form>
  );
}
