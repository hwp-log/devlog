import { getTilEntries } from '@/lib/til/actions';
import { formatRelativeTime } from '@/lib/util/formatRelativeTime';
import Link from 'next/link';

type TilEntry = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  type: 'TIL' | 'DeepDive' | 'TechStudy';
};

const badgeStyle: Record<string, string> = {
  TIL:       'bg-blue-100 text-blue-700',
  DeepDive:  'bg-emerald-100 text-emerald-700',
  TechStudy: 'bg-rose-100 text-rose-700',
};

const CARD_GRADIENTS = [
  'from-orange-700 to-amber-800',
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-violet-700',
  'from-pink-600 to-rose-700',
  'from-emerald-500 to-teal-600',
  'from-yellow-600 to-amber-700',
];

const FILTER_CHIPS = ['전체', '서울', '부산', '제주'];

export default async function DashboardPage() {
  const entriesResult = await getTilEntries();
  const entries: TilEntry[] = 'error' in entriesResult
    ? []
    : (entriesResult.data.entries as TilEntry[]).slice(0, 6);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-[#1A1A1A]">오늘의 스토리</h2>
          <div className="flex items-center gap-2">
            {FILTER_CHIPS.map((label, i) => (
              <span
                key={label}
                className={`px-3 py-1.5 text-xs font-medium rounded-full cursor-default select-none ${
                  i === 0
                    ? 'bg-[#1A1A1A] text-white'
                    : 'text-slate-600 border border-black/[0.06]'
                }`}
                style={i !== 0 ? {
                  background: 'rgba(255,255,255,0.7)',
                  backdropFilter: 'blur(10px)',
                } : undefined}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="text-slate-500 text-sm py-8 text-center">아직 작성한 기록이 없습니다</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {entries.map((entry, index) => (
              <li key={entry.id}>
                <Link
                  href={`/til/${entry.id}`}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 block h-full"
                >
                  <div className={`h-32 bg-gradient-to-br ${CARD_GRADIENTS[index % CARD_GRADIENTS.length]}`} />
                  <div className="p-4 flex flex-col gap-2">
                    <span className={`self-start text-xs font-medium rounded-md px-2 py-0.5 ${badgeStyle[entry.type] ?? badgeStyle['TIL']}`}>
                      {entry.type}
                    </span>
                    <h3 className="font-semibold text-slate-800 line-clamp-1">{entry.title}</h3>
                    <p className="text-sm text-slate-600 line-clamp-2 flex-1">{entry.content}</p>
                    <time className="text-xs text-slate-400">
                      {formatRelativeTime(entry.created_at)}
                    </time>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
