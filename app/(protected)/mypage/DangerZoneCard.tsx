'use client';
import { useState, useTransition } from 'react';
import { deleteAccountAction } from './actions';

const CONFIRM_PHRASE = '탈퇴합니다';

// 0529: 경고 면 — 왼쪽 4px 위험 바 + 연한 경고 면. 번호 없는 목록(순서가 아니라 목록),
// 맨 위 볼드 한 줄 + 마지막 줄만 위험색 강조. 접힘·펼침 양쪽에서 공유.
function WarningBox() {
  return (
    <div className="mt-[14px] sm:mt-4 rounded-lg bg-danger-surface border-l-4 border-danger p-4">
      <p className="text-sm font-bold text-danger">탈퇴하면 되돌릴 수 없습니다</p>
      <div className="mt-2 flex flex-col gap-1.5 text-sm leading-[1.55] text-fg2">
        <p>이메일과 프로필 사진은 삭제됩니다.</p>
        <p>작성한 스토리 · 계획은 &lsquo;익명의 계정명&rsquo;으로 남습니다.</p>
        <p>익명의 계정명은 &lsquo;잊혀진 여행자&rsquo;로 변경 · 표시됩니다.</p>
        <p>다시 가입하더라도 예전에 작성한 글과 계획을 연결할 수 없습니다.</p>
        <p className="font-semibold text-danger">로그인은 다시 할 수 없습니다.</p>
      </div>
    </div>
  );
}

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
      <div>
        <h2 className="text-lg font-bold tracking-[-0.01em] text-fg">계정 삭제</h2>
        <WarningBox />
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-4 sm:mt-[18px] w-full py-[13px] rounded-lg border border-danger text-danger text-[15px] font-semibold hover:bg-danger-fill hover:text-white hover:border-transparent transition-colors"
        >
          회원 탈퇴
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold tracking-[-0.01em] text-fg">계정 삭제</h2>
      <WarningBox />
      <p className="mt-4 text-sm text-fg2">
        진행하려면 아래 칸에 <span className="font-semibold text-fg">{CONFIRM_PHRASE}</span> 를
        입력하세요.
      </p>

      <input
        type="text"
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        placeholder={CONFIRM_PHRASE}
        disabled={isPending}
        className="mt-2 w-full border border-field-border rounded-lg px-[14px] py-[13px] text-base text-fg2 bg-bg placeholder:text-hint focus:outline-none focus:border-danger transition-colors disabled:opacity-50"
        autoFocus
      />

      {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}

      <div className="mt-4 sm:mt-[18px] flex gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!phraseMatched || isPending}
          className="flex-1 py-[13px] rounded-lg border border-danger text-danger text-[15px] font-semibold hover:bg-danger-fill hover:text-white hover:border-transparent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? '탈퇴 처리 중...' : '탈퇴 확정'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="flex-1 py-[13px] rounded-lg border border-field-border text-fg2 text-[15px] font-medium hover:bg-surface2 transition-colors disabled:opacity-50"
        >
          취소
        </button>
      </div>
    </div>
  );
}
