'use client';
// 폼의 상태와 에러를 관리
import { useActionState } from 'react';

type ActionState = { error: string } | { data: { user: unknown } } | null;

interface LoginFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}

export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction] = useActionState(action, null);

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
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
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
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>
      {state && 'error' in state && (
        <p role="alert" className="text-sm text-red-600">{state.error}</p>
      )}
      <button
        type="submit"
        className="mt-2 bg-slate-800 text-white rounded-lg py-2 text-sm font-medium hover:bg-slate-700 transition-colors"
      >
        로그인
      </button>
    </form>
  );
}
