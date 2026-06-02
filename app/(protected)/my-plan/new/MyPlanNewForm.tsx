'use client';
import { useActionState } from 'react';

type ActionState = { error: string } | null;

interface Props {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}

export function MyPlanNewForm({ action }: Props) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <div className="glass-outer p-8 max-w-lg">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="title" className="text-sm font-medium text-[#1A1A1A]">
            제목 <span className="text-red-400">*</span>
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            placeholder="계획 제목을 입력하세요"
            className="border-[0.5px] border-black/15 rounded-[10px] px-[14px] py-3 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:border-black/40 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.08)] transition-all"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="currency" className="text-sm font-medium text-[#1A1A1A]">통화</label>
          <select
            id="currency"
            name="currency"
            defaultValue="KRW"
            className="border-[0.5px] border-black/15 rounded-[10px] px-[14px] py-3 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:border-black/40 transition-all"
          >
            <option value="KRW">KRW — 한국 원</option>
            <option value="USD">USD — 미국 달러</option>
            <option value="JPY">JPY — 일본 엔</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="startDate" className="text-sm font-medium text-[#1A1A1A]">시작일</label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              className="border-[0.5px] border-black/15 rounded-[10px] px-[14px] py-3 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:border-black/40 transition-all"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="endDate" className="text-sm font-medium text-[#1A1A1A]">종료일</label>
            <input
              id="endDate"
              name="endDate"
              type="date"
              className="border-[0.5px] border-black/15 rounded-[10px] px-[14px] py-3 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:border-black/40 transition-all"
            />
          </div>
        </div>

        {state?.error && (
          <p role="alert" className="text-sm text-red-600">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="mt-1 bg-[#1A1A1A] text-white rounded-full py-[13px] text-sm font-semibold hover:bg-[#333] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? '저장 중...' : '계획 저장'}
        </button>
      </form>
    </div>
  );
}
