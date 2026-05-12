import { getTilEntries } from '@/lib/til/actions';
import Link from 'next/link';

type TilEntry = {
  id: string;
  title: string;
  content: string;
  created_at: string;
};

export default async function TilPage() {
  const result = await getTilEntries();

  if ('error' in result) {
    return <p className="text-sm text-red-600">{result.error}</p>;
  }

  const entries = result.data.entries as TilEntry[];

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-slate-500">
        <p>아직 TIL이 없어요</p>
        <Link
          href="/til/new"
          className="text-sm bg-slate-800 text-white rounded-lg px-4 py-2 hover:bg-slate-700 transition-colors"
        >
          첫 TIL 작성하기
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-slate-700">TIL 목록</h2>
        <Link
          href="/til/new"
          className="text-sm bg-slate-800 text-white rounded-lg px-4 py-2 hover:bg-slate-700 transition-colors"
        >
          새 TIL 작성
        </Link>
      </div>
      <ul className="flex flex-col gap-4">
        {entries.map((entry) => (
          <li key={entry.id} className="border border-slate-200 rounded-lg p-4 flex flex-col gap-2">
            <h3 className="font-semibold text-slate-800">{entry.title}</h3>
            <p className="text-sm text-slate-600 line-clamp-2">{entry.content}</p>
            <time className="text-xs text-slate-400">
              {new Date(entry.created_at).toLocaleDateString('ko-KR')}
            </time>
          </li>
        ))}
      </ul>
    </div>
  );
}
