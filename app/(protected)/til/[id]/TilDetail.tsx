'use client';
import { useState } from 'react';
import { updateTilEntryAction, deleteTilEntryAction } from './actions';

type TilEntry = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  type: 'TIL' | 'DeepDive' | 'TechStudy';
};

export default function TilDetail({ entry }: { entry: TilEntry }) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <form action={updateTilEntryAction} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={entry.id} />
        <input
          name="title"
          defaultValue={entry.title}
          className="border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        <textarea
          name="content"
          defaultValue={entry.content}
          rows={6}
          className="border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="bg-slate-800 text-white rounded-lg px-4 py-2 hover:bg-slate-700 transition-colors text-sm"
          >
            저장
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="bg-slate-200 text-slate-700 rounded-lg px-4 py-2 hover:bg-slate-300 transition-colors text-sm"
          >
            취소
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-slate-800">{entry.title}</h1>
      <p className="text-slate-600 whitespace-pre-wrap">{entry.content}</p>
      <time className="text-xs text-slate-400">
        {new Date(entry.created_at).toLocaleDateString('ko-KR')}
      </time>
      <div className="flex gap-2">
        <button
          onClick={() => setIsEditing(true)}
          className="bg-slate-800 text-white rounded-lg px-4 py-2 hover:bg-slate-700 transition-colors text-sm"
        >
          수정
        </button>
        <form action={deleteTilEntryAction}>
          <input type="hidden" name="id" value={entry.id} />
          <button
            type="submit"
            onClick={(e) => { if (!confirm('정말 삭제할까요?')) e.preventDefault(); }}
            className="bg-red-100 text-red-700 rounded-lg px-4 py-2 hover:bg-red-200 transition-colors text-sm"
          >
            삭제
          </button>
        </form>
      </div>
    </div>
  );
}
