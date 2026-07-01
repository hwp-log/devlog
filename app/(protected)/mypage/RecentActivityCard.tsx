import Link from 'next/link';

type Item = { id: string; title: string; createdAt: Date };

interface Props {
  recentStories: Item[];
  recentPlans: Item[];
}

function formatDate(d: Date) {
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

function Row({ href, title, createdAt }: { href: string; title: string; createdAt: Date }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-2 py-1.5 group">
        <span className="min-w-0 flex-1 text-sm text-slate-700 truncate group-hover:text-[#1A1A1A]">
          {title}
        </span>
        <span className="text-xs text-slate-400 shrink-0">{formatDate(createdAt)}</span>
      </Link>
    </li>
  );
}

export function RecentActivityCard({ recentStories, recentPlans }: Props) {
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-sm font-semibold text-slate-700">최근 활동</h2>

      <section className="space-y-1">
        <h3 className="text-xs font-semibold text-slate-500">최근 스토리</h3>
        {recentStories.length > 0 ? (
          <ul>
            {recentStories.map((s) => (
              <Row key={s.id} href={`/story/${s.id}`} title={s.title} createdAt={s.createdAt} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-400 py-1.5">아직 없음</p>
        )}
      </section>

      <section className="space-y-1">
        <h3 className="text-xs font-semibold text-slate-500">최근 계획</h3>
        {recentPlans.length > 0 ? (
          <ul>
            {recentPlans.map((p) => (
              <Row key={p.id} href={`/my-plan/${p.id}`} title={p.title} createdAt={p.createdAt} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-400 py-1.5">아직 없음</p>
        )}
      </section>
    </div>
  );
}
