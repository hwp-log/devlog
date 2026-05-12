'use client';
import { useActionState } from 'react';

type ActionState = { error: string } | { data: { entry: unknown } } | null;

interface TilFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}

export function TilForm({ action }: TilFormProps) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium text-slate-600">제목</label>
        <input
          id="title"
          name="title"
          type="text"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="content" className="text-sm font-medium text-slate-600">내용</label>
        <textarea
          id="content"
          name="content"
          rows={6}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
        />
      </div>
      {state && 'error' in state && (
        <p role="alert" className="text-sm text-red-600">{state.error}</p>
      )}
      <button
        type="submit"
        className="mt-2 bg-slate-800 text-white rounded-lg py-2 text-sm font-medium hover:bg-slate-700 transition-colors"
      >
        저장
      </button>
    </form>
  );
}
