'use client';
// 페이지네이션(0416): 클라이언트 슬라이스 방식.
// ⚠️ 이건 "이미지 로딩"만 해결한다 — page.tsx가 fetchPublicPlans로 공개 플랜을 여전히 전량 수신하고,
//    여기서 정렬·필터·슬라이스한다. 데이터 전송량은 그대로. 현재 페이지 카드 12장만 마운트돼
//    next/image가 12장만 요청하는 게 이득의 전부.
// 서버 페이지네이션으로 전환하려면 선행 조건: 정렬·필터 기준인 가격대 band가 비용 합산 "파생값"이라
//    SQL where/order로 못 쓴다 → 플랜 총액을 MyPlan 컬럼으로 저장(생성·수정 시 집계)해야
//    DB LIMIT/OFFSET + 총액 필터/정렬이 가능해진다. 그 전엔 서버 전환 이득이 없다.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { PublicPlanListItem } from '@/lib/plan/queries';
import { PLAN_PAGE_SIZE } from '@/lib/plan/pagination';
import { PlanCard } from './PlanCard';
import { FilterDropdown } from './FilterDropdown';
import { PlanFinderHeader } from './PlanFinderHeader';
import { Pagination } from '../../_components/Pagination';

// SSR useLayoutEffect 경고 회피 — 스크롤은 클라 전용 (StoryListPaged와 동일 1줄 alias.
// lib 추출은 스토리 파일 수정을 수반해 미룸 — 바꿀 땐 두 곳 함께)
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

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
  const [page, setPage]     = useState(1);

  // 페이지 전환 애니메이션 없음(0430, 0427·0429 되돌림): 데이터가 이미 클라이언트에 있어
  // 즉시 교체하면 빈 구간도 번쩍임도 없다. 서버 대기가 0이라 스켈레톤이 한 프레임만 스쳐 번쩍이던 문제 제거.
  // 진입 로딩(loading.tsx)은 실제 서버 대기이므로 그대로 유지.

  // 페이지 변경 시 문서 최상단으로(스토리와 동일 UX). 첫 마운트는 skip.
  // useLayoutEffect: 슬라이스 교체 커밋 후·페인트 전 실행 → 새 페이지가 이전 스크롤 위치로 그려지는 프레임 없음.
  const didMount = useRef(false);
  useIsoLayoutEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    window.scrollTo(0, 0);
  }, [page]);

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

  // 클라이언트 슬라이스: 정렬·필터 완료된 sorted를 PLAN_PAGE_SIZE(12)개씩 자름(개수는 sorted.length 그대로 노출).
  // 필터·정렬 변경 시 setPage(1)로 되돌리므로 page는 항상 유효하나, 리셋 직전 프레임 방어로 클램프.
  const totalPages = Math.max(1, Math.ceil(sorted.length / PLAN_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = sorted.slice((currentPage - 1) * PLAN_PAGE_SIZE, currentPage * PLAN_PAGE_SIZE);

  // 페이지 넘김: 즉시 슬라이스 교체(+ layout effect 최상단 스크롤). 클라 데이터라 대기·전환 없음.
  const goTo = (next: number) => {
    if (next < 1 || next > totalPages || next === currentPage) return;
    setPage(next);
  };

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
            onChange={(next) => { setFilter(next); setPage(1); }}
          />
          <FilterDropdown<SortKey>
            label="정렬"
            options={SORT_LABELS}
            value={sort}
            onChange={(next) => { setSort(next); setPage(1); }}
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="border-[1.5px] border-dashed border-border rounded-[14px] p-[22px] flex flex-col items-center text-center gap-3">
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
        // 0425: 열 수를 1·2·3·4·6(PLAN_PAGE_SIZE 12의 약수)으로 제한 — auto-fill의 5·7열에서 마지막 줄이 비는 문제 해결.
        // 브레이크포인트 = 카드 320px 하한 보장값(콘텐츠 폭 = 뷰포트−px-6 48, gap 14): 2열 702·3열 1036·4열 1370·6열 2038 절상.
        // 1열 트랙 min(320px,100%): 320px 뷰포트(콘텐츠 272px)에서 컨테이너 폭까지 줄여 가로 넘침 방지, 넓은 화면 320 하한 유지.
        // 카드 등장 모션 없음(0428, 스토리 StoryCardList와 통일).
        // 0430: 페이지 전환 애니메이션 제거 — 즉시 슬라이스 교체(클라 데이터라 대기 없음, 번쩍임·빈 구간 없음).
        <div className="grid grid-cols-[minmax(min(320px,100%),1fr)] min-[704px]:grid-cols-2 min-[1040px]:grid-cols-3 min-[1372px]:grid-cols-4 min-[2040px]:grid-cols-6 gap-[11px] sm:gap-[14px]">
          {pageItems.map((plan) => (
            <PlanCard key={plan.id} {...plan} />
          ))}
        </div>
      )}

      <Pagination
        page={currentPage}
        totalPages={totalPages}
        onGo={goTo}
      />
    </div>
  );
}
