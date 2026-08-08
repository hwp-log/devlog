'use client';
import { useState, useTransition } from 'react';
import { renameMovie, unapproveMovie } from '../actions';

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface Props {
  id: string;
  title: string;
  spotCount: number;
  createdAt: Date;
}

export function ApprovedMovieRow({ id, title, spotCount, createdAt }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleEdit = () => {
    setValue(title);
    setError(null);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setError(null);
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await renameMovie(id, value);
      if ('error' in result) {
        setError(result.error);
      } else {
        setEditing(false);
      }
    });
  };

  const handleUnapprove = () => {
    setError(null);
    startTransition(async () => {
      const result = await unapproveMovie(id);
      if ('error' in result) setError(result.error);
    });
  };

  return (
    <div className="p-6 flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        {editing ? (
          <>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={isPending}
              // 0573: 색만 토큰화(ring-slate-300 → ring-fg/20). 레포 관용구는 ring이 아니라
              //   focus:border-fg/40(INPUT_CLASS, 0527)이지만, 방식을 바꾸면 라이트 표현이
              //   달라져 이번 범위(색·유틸 전환만)를 벗어난다 — 포커스 방식 통일은 별건.
              className="w-full border border-field-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-fg/20 disabled:opacity-50"
            />
            <p className="text-xs text-muted mt-2">
              Spot {spotCount}개 · {formatYmd(createdAt)}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-fg truncate">{title}</p>
            <p className="text-xs text-muted mt-1">
              Spot {spotCount}개 · {formatYmd(createdAt)}
            </p>
          </>
        )}
        {error && <p className="text-xs text-danger mt-2">{error}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {editing ? (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="btn-elevated px-3 py-1.5 text-xs text-fg2 disabled:opacity-50"
            >
              저장
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="btn-elevated px-3 py-1.5 text-xs text-muted disabled:opacity-50"
            >
              취소
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleEdit}
              disabled={isPending}
              className="btn-elevated px-3 py-1.5 text-xs text-fg2 disabled:opacity-50"
            >
              수정
            </button>
            <button
              type="button"
              onClick={handleUnapprove}
              disabled={isPending}
              className="btn-elevated px-3 py-1.5 text-xs text-fg2 disabled:opacity-50"
            >
              대기로 되돌리기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
