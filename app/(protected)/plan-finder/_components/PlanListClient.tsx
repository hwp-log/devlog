'use client';
import { useState } from 'react';
import type { PublicPlanListItem } from '@/lib/plan/queries';
import { PlanCard } from './PlanCard';
import { FilterDropdown } from './FilterDropdown';

type SortKey = 'popular' | 'newest' | 'price_asc' | 'price_desc';
type FilterKey = 'all' | 'under50' | '50to100' | 'over100';

const SORT_LABELS: Record<SortKey, string> = {
  popular:    '인기순',
  newest:     '최신순',
  price_asc:  '가격 낮은순',
  price_desc: '가격 높은순',
};

const FILTER_LABELS: Record<FilterKey, string> = {
  all:       '전체',
  under50:   '~50만',
  '50to100': '50~100만',
  over100:   '100만~',
};

function getFilterKey(plan: PublicPlanListItem): FilterKey | null {
  const lower = plan.summary.band?.lower;
  if (lower === undefined || lower === null) return null;
  if (lower < 500_000)   return 'under50';
  if (lower < 1_000_000) return '50to100';
  return 'over100';
}

export function PlanListClient({ plans }: { plans: PublicPlanListItem[] }) {
  const [sort, setSort]     = useState<SortKey>('popular');
  const [filter, setFilter] = useState<FilterKey>('all');

  const filtered = filter === 'all'
    ? plans
    : plans.filter((p) => getFilterKey(p) === filter);

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'popular') return b.likeCount - a.likeCount;
    if (sort === 'newest')  return b.createdAt.getTime() - a.createdAt.getTime();
    const aLower = a.summary.band?.lower ?? (sort === 'price_asc' ? Infinity : -1);
    const bLower = b.summary.band?.lower ?? (sort === 'price_asc' ? Infinity : -1);
    return sort === 'price_asc' ? aLower - bLower : bLower - aLower;
  });

  const withBand = sorted.filter((p) => p.summary.band);
  const avgWon = withBand.length > 0
    ? Math.round(
        withBand.reduce((s, p) => s + (p.summary.band!.lower + p.summary.band!.upper) / 2, 0)
        / withBand.length / 10_000,
      )
    : null;

  return (
    <div className="bg-slate-100 rounded-xl p-5">
      {avgWon !== null && (
        <p
          className="text-sm text-slate-500 mb-3 ml-0.5 appear-up"
          style={{ animationDelay: '0.24s' }}
        >
          <span className="text-[#0369A1] font-semibold">{sorted.length}개</span> 코스 · 평균{' '}
          <span className="text-[#0369A1] font-semibold">약 {avgWon.toLocaleString()}만원</span>
        </p>
      )}

      <div
        className="flex flex-wrap gap-2 mb-4 appear-up"
        style={{ animationDelay: '0.36s' }}
      >
        <FilterDropdown<FilterKey>
          label="가격대"
          options={FILTER_LABELS}
          value={filter}
          onChange={setFilter}
        />
        <FilterDropdown<SortKey>
          label="정렬"
          options={SORT_LABELS}
          value={sort}
          onChange={setSort}
        />
      </div>

      {sorted.length === 0 ? (
        <div className="glass-outer p-12 text-center text-slate-500">
          이 가격대 플랜이 없습니다
        </div>
      ) : (
        <div className="flex flex-col gap-[10px]">
          {sorted.map((plan, i) => (
            <div
              key={plan.id}
              className="appear-up"
              style={{ animationDelay: `${i < 8 ? 0.48 + i * 0.12 : 1.32}s` }}
            >
              <PlanCard {...plan} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
