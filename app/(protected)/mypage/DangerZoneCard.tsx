'use client';
import { useState, useTransition } from 'react';
import { deleteAccountAction } from './actions';

const CONFIRM_PHRASE = '탈퇴합니다';

export function DangerZoneCard() {
  const [expanded, setExpanded] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const phraseMatched = phrase === CONFIRM_PHRASE;

  function handleCancel() {
    setExpanded(false);
    setPhrase('');
    setError(null);
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteAccountAction();
      if (result?.error) setError(result.error);
      // 성공 시 서버가 redirect → 클라 자동 이동
    });
  }

  if (!expanded) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-rose-500">DangerZone</h2>
        <ol className="list-decimal list-inside space-y-2 text-xs text-slate-500">
          <li>이메일과 프로필 사진은 삭제됩니다.</li>
          <li>작성한 스토리 · 계획은 &lsquo;익명의 계정명&rsquo;으로 남습니다.</li>
          <li>익명의 계정명은 &lsquo;잊혀진 여행자&rsquo;로 변경 · 표시됩니다.</li>
          <li>다시 가입하더라도 예전에 작성한 글과 계획을 연결할 수 없습니다.</li>
          <li className="text-rose-500">로그인은 다시 할 수 없습니다.</li>
        </ol>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="btn-elevated px-4 py-2 text-sm text-rose-500"
        >
          회원 탈퇴
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-rose-500">회원 탈퇴 확인</h2>
      <div className="space-y-2 text-xs text-slate-600">
        <p>이 작업은 되돌릴 수 없습니다.</p>
        <ol className="list-decimal list-inside space-y-1 text-slate-500">
          <li>이메일과 프로필 사진은 삭제됩니다.</li>
          <li>작성한 스토리 · 계획은 &lsquo;익명의 계정명&rsquo;으로 남습니다.</li>
          <li>익명의 계정명은 &lsquo;잊혀진 여행자&rsquo;로 변경 · 표시됩니다.</li>
          <li>다시 가입하더라도 예전에 작성한 글과 계획을 연결할 수 없습니다.</li>
          <li>로그인은 다시 할 수 없습니다.</li>
        </ol>
        <p className="pt-2 text-slate-700">
          진행하려면 아래 칸에 <span className="font-semibold">{CONFIRM_PHRASE}</span> 를 입력하세요.
        </p>
      </div>

      <input
        type="text"
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        placeholder={CONFIRM_PHRASE}
        disabled={isPending}
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-rose-400 disabled:opacity-50"
        autoFocus
      />

      {error ? (
        <p className="text-xs text-rose-500">{error}</p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!phraseMatched || isPending}
          className="btn-elevated px-4 py-2 text-sm text-rose-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? '탈퇴 처리 중...' : '탈퇴 확정'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="btn-elevated px-4 py-2 text-sm text-slate-600 disabled:opacity-50"
        >
          취소
        </button>
      </div>
    </div>
  );
}
