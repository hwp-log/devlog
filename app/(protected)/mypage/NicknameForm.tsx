'use client';
import { useState, useTransition } from 'react';
import { updateNicknameAction } from './actions';

interface Props { email: string; nickname: string }

export function NicknameForm({ email, nickname: initialNickname }: Props) {
  const [value, setValue] = useState(initialNickname);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await updateNicknameAction(value);
      if (result?.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: '저장되었습니다' });
      }
    });
  };

  return (
    <div className="glass-outer p-6 space-y-6">
      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">이메일</label>
        <p className="text-sm text-slate-700">{email}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block" htmlFor="nickname">
            닉네임
          </label>
          <input
            id="nickname"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={20}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
        {message && (
          <p className={`text-xs ${message.type === 'error' ? 'text-rose-500' : 'text-emerald-600'}`}>
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="btn-elevated px-4 py-2 text-sm text-slate-700 disabled:opacity-50"
        >
          저장
        </button>
      </form>
    </div>
  );
}
