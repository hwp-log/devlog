'use client';
import { useState, useEffect, useRef } from 'react';
import { FilterDropdown } from '@/app/(protected)/plan-finder/_components/FilterDropdown';
import { CardReveal } from '@/app/story/_components/CardReveal';
import { MyPlanCard, type Ratio } from './MyPlanCard';

type Currency = 'KRW' | 'USD' | 'JPY';

export type MyPlanListItem = {
  id: string;
  title: string;
  region: string | null;
  currency: Currency;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  spotCount: number;
  total: number;
  band: { lower: number; upper: number } | null;
  ratios: Ratio[];
};

type SortKey = 'newest' | 'startDate' | 'price_asc' | 'price_desc';
type FilterKey = 'all' | 'under50' | '50to100' | 'over100';

const SORT_LABELS: Record<SortKey, string> = {
  newest:     '최신순',
  startDate:  '시작일순',
  price_asc:  '가격 낮은순',
  price_desc: '가격 높은순',
};

const FILTER_LABELS: Record<FilterKey, string> = {
  all:       '전체',
  under50:   '~50만',
  '50to100': '50~100만',
  over100:   '100만~',
};

function getFilterKey(item: MyPlanListItem): FilterKey | null {
  const lower = item.band?.lower;
  if (lower == null) return null;
  if (lower < 500_000) return 'under50';
  if (lower < 1_000_000) return '50to100';
  return 'over100';
}

export function MyPlanListClient({ items }: { items: MyPlanListItem[] }) {
  const [sort, setSort] = useState<SortKey>('newest');
  const [filter, setFilter] = useState<FilterKey>('all');

  const initialPhaseRef = useRef(true);
  useEffect(() => {
    const t = setTimeout(() => {
      initialPhaseRef.current = false;
    }, 200);
    return () => clearTimeout(t);
  }, []);

  const filtered = filter === 'all'
    ? items
    : items.filter((p) => getFilterKey(p) === filter);

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'newest') return b.createdAt.getTime() - a.createdAt.getTime();
    if (sort === 'startDate') {
      const at = a.startDate?.getTime();
      const bt = b.startDate?.getTime();
      if (at == null && bt == null) return 0;
      if (at == null) return 1;
      if (bt == null) return -1;
      return at - bt;
    }
    return sort === 'price_asc' ? a.total - b.total : b.total - a.total;
  });

  const withTotal = sorted.filter((p) => p.total > 0);
  const avgWon = withTotal.length > 0
    ? Math.floor(
        withTotal.reduce((s, p) => s + p.total, 0) / withTotal.length / 10_000,
      )
    : null;

  return (
    <div className="bg-slate-100 rounded-xl p-5">
      {avgWon !== null && (
        <p
          className="text-sm text-slate-500 mb-3 ml-0.5 appear-up"
          style={{ animationDelay: '0.24s' }}
        >
          <span className="text-[#0369A1] font-semibold">{sorted.length}개</span> 계획 · 평균{' '}
          <span className="text-[#0369A1] font-semibold">약 {avgWon.toLocaleString()}만원</span>
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-4 relative z-10">
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
          이 가격대 계획이 없어요
        </div>
      ) : (
        <div key={`${sort}-${filter}`} className="flex flex-col gap-[10px]">
          {sorted.map((plan, i) => (
            <CardReveal key={plan.id} index={i} initialPhaseRef={initialPhaseRef} staggerOnRemount>
              <MyPlanCard {...plan} />
            </CardReveal>
          ))}
        </div>
      )}
    </div>
  );
}
