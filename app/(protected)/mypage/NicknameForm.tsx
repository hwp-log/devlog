'use client';
import { useState, useTransition } from 'react';
import { updateNicknameAction } from './actions';

interface Props {
  email: string;
  nickname: string;
  /** 0529: 아바타 조작부(AvatarControls) — 시안 순서(이메일→닉네임→프로필 사진→저장)대로 닉네임과 저장 사이에 끼운다 */
  children?: React.ReactNode;
}

export function NicknameForm({ email, nickname: initialNickname, children }: Props) {
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
    <div>
      <h2 className="text-lg font-bold tracking-[-0.01em] text-fg">계정 설정</h2>
      <div className="mt-[18px] sm:mt-5">
        <label className="text-xs font-medium text-muted mb-1.5 block">이메일</label>
        <p className="text-base text-muted">
          {email} <span className="text-xs text-hint max-sm:hidden">변경 불가</span>
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mt-4 sm:mt-[18px]">
          <label className="text-xs font-medium text-muted mb-1.5 block" htmlFor="nickname">
            닉네임
          </label>
          <input
            id="nickname"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={20}
            className="w-full border border-field-border rounded-lg px-[14px] py-[13px] text-base text-fg2 bg-bg placeholder:text-hint focus:outline-none focus:border-fg/40 transition-colors"
          />
        </div>
        <div className="mt-4 sm:mt-[18px]">{children}</div>
        {message && (
          <p className={`mt-3 text-xs ${message.type === 'error' ? 'text-danger' : 'text-emerald-600'}`}>
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="mt-5 sm:mt-[22px] w-full py-[14px] rounded-lg bg-primary text-white text-[15px] font-bold transition-opacity disabled:opacity-50"
        >
          저장
        </button>
      </form>
    </div>
  );
}
