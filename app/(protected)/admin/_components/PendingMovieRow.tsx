'use client';
import { useState, useTransition } from 'react';
import { approveMovie, rejectMovie, mergeMovie } from '../actions';

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

type Candidate = { id: string; title: string; spotCount: number };

interface Props {
  id: string;
  title: string;
  spotCount: number;
  createdAt: Date;
  candidates: Candidate[];
}

export function PendingMovieRow({ id, title, spotCount, createdAt, candidates }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      const result = await approveMovie(id);
      if ('error' in result) setError(result.error);
    });
  };

  const handleReject = () => {
    setError(null);
    startTransition(async () => {
      const result = await rejectMovie(id);
      if ('error' in result) setError(result.error);
    });
  };

  const handleMerge = (targetId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await mergeMovie(id, targetId);
      if ('error' in result) setError(result.error);
    });
  };

  return (
    <div className="p-6 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#1A1A1A] truncate">{title}</p>
          <p className="text-xs text-slate-500 mt-1">
            Spot {spotCount}개 · {formatYmd(createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleApprove}
            disabled={isPending}
            className="btn-elevated px-3 py-1.5 text-xs text-slate-700 disabled:opacity-50"
          >
            승인
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={isPending}
            className="btn-elevated px-3 py-1.5 text-xs text-rose-600 disabled:opacity-50"
          >
            거절
          </button>
        </div>
      </div>

      {candidates.length > 0 && (
        <div className="pt-3 border-t border-black/5 space-y-2">
          <p className="text-xs text-slate-500">유사한 승인 작품:</p>
          <div className="flex flex-wrap gap-2">
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleMerge(c.id)}
                disabled={isPending}
                className="btn-elevated px-3 py-1.5 text-xs text-slate-700 disabled:opacity-50"
              >
                {c.title} (Spot {c.spotCount}개)(으)로 병합
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}
