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
      <Link
        href={href}
        className="flex items-center justify-between gap-3 sm:gap-5 py-[13px] sm:py-[14px] border-b border-hairline group"
      >
        <span className="min-w-0 flex-1 text-base font-medium text-fg2 truncate group-hover:text-fg transition-colors">
          {title}
        </span>
        <span className="text-sm text-muted shrink-0">{formatDate(createdAt)}</span>
      </Link>
    </li>
  );
}

export function RecentActivityCard({ recentStories, recentPlans }: Props) {
  return (
    <div className="mt-[30px] sm:mt-[38px]">
      <div className="flex items-baseline justify-between gap-3 border-b-2 border-section-rule pb-2 sm:pb-2.5">
        <h2 className="text-[20px] sm:text-[22px] font-bold tracking-[-0.02em] text-fg break-keep">
          최근 활동
        </h2>
        <span className="text-xs sm:text-sm text-muted shrink-0">최신순</span>
      </div>

      <section>
        <h3 className="mt-4 sm:mt-5 text-xs font-medium tracking-[0.04em] text-muted">최근 스토리</h3>
        {recentStories.length > 0 ? (
          <ul className="mt-1">
            {recentStories.map((s) => (
              <Row key={s.id} href={`/story/${s.id}`} title={s.title} createdAt={s.createdAt} />
            ))}
          </ul>
        ) : (
          <p className="py-[13px] sm:py-[14px] border-b border-hairline text-sm text-muted">아직 없음</p>
        )}
      </section>

      <section>
        <h3 className="mt-[22px] sm:mt-[26px] text-xs font-medium tracking-[0.04em] text-muted">최근 계획</h3>
        {recentPlans.length > 0 ? (
          <ul className="mt-1">
            {recentPlans.map((p) => (
              // 0560: 상세 한 벌화 — 플랜 상세는 공개 상세(/plan-finder/[id])가 정본
              <Row key={p.id} href={`/plan-finder/${p.id}`} title={p.title} createdAt={p.createdAt} />
            ))}
          </ul>
        ) : (
          <p className="py-[13px] sm:py-[14px] border-b border-hairline text-sm text-muted">아직 없음</p>
        )}
      </section>
    </div>
  );
}
