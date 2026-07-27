'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { PublicPlanListItem } from '@/lib/plan/queries';
import { PlanCard } from './PlanCard';
import { FilterDropdown } from './FilterDropdown';
import { PlanFinderHeader } from './PlanFinderHeader';

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

  // 첫 렌더에만 순차 지연(0.48)을 주고, 필터·정렬을 바꾸면 즉시 등장(0).
  // 리렌더 원인이 sort/filter뿐이므로 "아직 안 바꿨나"를 state로 판별한다.
  const [hasInteracted, setHasInteracted] = useState(false);
  const baseDelay = hasInteracted ? 0 : 0.48;

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
    <div>
      {/* 헤더 행 — 눈썹·타이틀·요약(좌) / 필터(우). 데스크톱 flex-end 정렬, 모바일 세로 스택·필터 좌측 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4 sm:mb-6">
        <div>
          <PlanFinderHeader />
          <p
            className="text-[12.5px] text-muted mt-4 sm:mt-5 appear-up"
            style={{ animationDelay: '0.24s' }}
          >
            공개 코스 {sorted.length}개
            {avgWon !== null && ` · 평균 약 ${avgWon.toLocaleString()}만원`}
          </p>
        </div>
        <div
          className="flex flex-wrap gap-2 appear-up relative z-10"
          style={{ animationDelay: '0.36s' }}
        >
          <FilterDropdown<FilterKey>
            label="가격대"
            options={FILTER_LABELS}
            value={filter}
            onChange={(next) => { if (next !== filter) setHasInteracted(true); setFilter(next); }}
          />
          <FilterDropdown<SortKey>
            label="정렬"
            options={SORT_LABELS}
            value={sort}
            onChange={(next) => { if (next !== sort) setHasInteracted(true); setSort(next); }}
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <div
          key={`empty-${sort}-${filter}`}
          className="border-[1.5px] border-dashed border-border rounded-[14px] p-[22px] flex flex-col items-center text-center gap-3 appear-up"
          style={{ animationDelay: `${baseDelay}s` }}
        >
          <span className="w-2 h-2 rounded-full bg-primary" />
          <p className="text-[13px] leading-[1.6] text-fg2 break-keep">
            이 가격대의 코스가 아직 없어요.
            <br />
            첫 코스의 점을 찍어보세요.
          </p>
          <Link
            href="/my-plan/new"
            className="inline-flex items-center rounded-full border border-border px-4 py-2 text-[13px] text-fg2 hover:bg-surface2 transition-colors"
          >
            내 플랜 공개하기
          </Link>
        </div>
      ) : (
        <div key={`${sort}-${filter}`} className="grid grid-cols-1 sm:grid-cols-3 gap-[11px] sm:gap-[14px]">
          {sorted.map((plan, i) => (
            <div
              key={plan.id}
              className="appear-up"
              style={{ animationDelay: `${baseDelay + (i < 8 ? i * 0.12 : 0.84)}s` }}
            >
              <PlanCard {...plan} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
