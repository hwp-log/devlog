'use client';
import { useState } from 'react';
import Link from 'next/link';
import { FilterDropdown } from '@/app/(protected)/plan-finder/_components/FilterDropdown';
import { CATEGORIES, CATEGORY_COLOR, CATEGORY_LABEL, FLIGHT_COLOR, formatAmount } from '../_lib/cost';
import { calcCostSummary } from '@/lib/plan/calc-cost-summary';

type Currency = 'KRW' | 'USD' | 'JPY';

export type MyPlanListItem = {
  id: string;
  title: string;
  currency: Currency;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  spotCount: number;
  costs: { category: string; amount: number }[];
  flight: { totalAmount: number } | null;
  total: number;
  band: { lower: number; upper: number } | null;
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

  return (
    <div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sorted.map((plan) => {
            const summary = calcCostSummary(plan.costs);
            const total = plan.total;
            const isEmpty = total === 0;
            const flightAmt = plan.flight?.totalAmount ?? 0;

            return (
              <Link
                key={plan.id}
                href={`/my-plan/${plan.id}`}
                className="glass-outer glass-outer-interactive overflow-hidden block cursor-pointer"
              >
                <div className="p-5">
                  {/* 제목 + chevron */}
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h2 className="text-base font-semibold text-[#1A1A1A] leading-snug">{plan.title}</h2>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400 mt-0.5">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>

                  {/* 메타: 기간 · 스팟 수 */}
                  <p className="text-xs text-slate-400 mb-4">
                    {plan.startDate && plan.endDate
                      ? `${plan.startDate.toLocaleDateString('ko-KR')} ~ ${plan.endDate.toLocaleDateString('ko-KR')}`
                      : '기간 미설정'}
                    {' · '}
                    스팟 {plan.spotCount}개
                  </p>

                  {isEmpty ? (
                    <p className="text-xs text-slate-400 py-3">예산 미입력</p>
                  ) : (
                    <>
                      {/* 누적 막대 */}
                      <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 mb-3">
                        {flightAmt > 0 && (
                          <div style={{ width: `${(flightAmt / total) * 100}%`, backgroundColor: FLIGHT_COLOR }} />
                        )}
                        {CATEGORIES.map((cat) =>
                          summary[cat] > 0 ? (
                            <div
                              key={cat}
                              style={{ width: `${(summary[cat] / total) * 100}%`, backgroundColor: CATEGORY_COLOR[cat] }}
                            />
                          ) : null
                        )}
                      </div>

                      {/* 총액 */}
                      <p className="text-right text-xl font-bold text-[#1A1A1A] mb-3">
                        {formatAmount(total, plan.currency)}
                      </p>

                      {/* 범례: 비용 > 0 항목만 */}
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {flightAmt > 0 && (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: FLIGHT_COLOR }} />
                            항공
                          </span>
                        )}
                        {CATEGORIES.map((cat) =>
                          summary[cat] > 0 ? (
                            <span key={cat} className="flex items-center gap-1 text-xs text-slate-500">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLOR[cat] }} />
                              {CATEGORY_LABEL[cat]}
                            </span>
                          ) : null
                        )}
                      </div>
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
