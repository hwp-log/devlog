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
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
            />
            <p className="text-xs text-slate-500 mt-2">
              Spot {spotCount}개 · {formatYmd(createdAt)}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-[#1A1A1A] truncate">{title}</p>
            <p className="text-xs text-slate-500 mt-1">
              Spot {spotCount}개 · {formatYmd(createdAt)}
            </p>
          </>
        )}
        {error && <p className="text-xs text-rose-500 mt-2">{error}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {editing ? (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="btn-elevated px-3 py-1.5 text-xs text-slate-700 disabled:opacity-50"
            >
              저장
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="btn-elevated px-3 py-1.5 text-xs text-slate-500 disabled:opacity-50"
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
              className="btn-elevated px-3 py-1.5 text-xs text-slate-700 disabled:opacity-50"
            >
              수정
            </button>
            <button
              type="button"
              onClick={handleUnapprove}
              disabled={isPending}
              className="btn-elevated px-3 py-1.5 text-xs text-slate-700 disabled:opacity-50"
            >
              대기로 되돌리기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
