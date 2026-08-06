'use client';
import { useState, useTransition } from 'react';
import { updatePasswordAction } from './actions';

const inputClass =
  'w-full border border-field-border rounded-lg px-[14px] py-[13px] text-base text-fg2 bg-bg placeholder:text-hint focus:outline-none focus:border-fg/40 transition-colors';

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: '모든 항목을 입력해주세요' });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: '비밀번호는 8자 이상이어야 합니다' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '새 비밀번호가 일치하지 않습니다' });
      return;
    }

    startTransition(async () => {
      const result = await updatePasswordAction(currentPassword, newPassword);
      if (result?.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: '비밀번호가 변경되었습니다' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    });
  };

  return (
    <div>
      <h2 className="text-lg font-bold tracking-[-0.01em] text-fg">비밀번호 변경</h2>
      <form onSubmit={handleSubmit}>
        <div className="mt-[18px] sm:mt-5 flex flex-col gap-3.5">
          <div>
            <label className="text-xs font-medium text-muted mb-1.5 block" htmlFor="currentPassword">
              현재 비밀번호
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted mb-1.5 block" htmlFor="newPassword">
              새 비밀번호
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted mb-1.5 block" htmlFor="confirmPassword">
              새 비밀번호 확인
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
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
          비밀번호 변경
        </button>
      </form>
    </div>
  );
}
