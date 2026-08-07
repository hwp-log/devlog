'use client';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { FilterDropdown } from '@/app/(protected)/plan-finder/_components/FilterDropdown';
import { MyPlanCard } from './MyPlanCard';
import { Pagination } from '@/app/(protected)/_components/Pagination';
import { PLAN_PAGE_SIZE } from '@/lib/plan/pagination';

// SSR useLayoutEffect 경고 회피 — 스크롤은 클라 전용 (PlanListClient·StoryListPaged와 동일
// 1줄 alias. lib 추출은 두 파일 수정을 수반해 미룸 — 바꿀 땐 세 곳 함께)
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

type Currency = 'KRW' | 'USD' | 'JPY';

export type MyPlanListItem = {
  id: string;
  title: string;
  region: string | null;
  movie: string | null;
  coverUrl: string | null;
  currency: Currency;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  spotCount: number;
  headcount: number;
  total: number;
  band: { lower: number; upper: number } | null;
  isPublic: boolean;
  isDraft: boolean;
  likeCount: number;
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
  // 0544: 클라이언트 슬라이스 페이지네이션 — 필터·정렬이 클라이언트라 페이지도 같은 층(0416 방식 이식)
  const [page, setPage] = useState(1);

  // 페이지 변경 시 문서 최상단으로(플랜파인더·스토리와 동일 UX). 첫 마운트는 skip.
  // useLayoutEffect: 슬라이스 교체 커밋 후·페인트 전 실행 → 이전 스크롤 위치로 그려지는 프레임 없음.
  const didMount = useRef(false);
  useIsoLayoutEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    window.scrollTo(0, 0);
  }, [page]);

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

  // 0544: 정렬·필터 완료된 sorted를 PLAN_PAGE_SIZE(12)씩 슬라이스 — 지표는 sorted 전체 기준 유지.
  // 필터·정렬 변경 시 setPage(1)로 되돌리므로 page는 항상 유효하나, 리셋 직전 프레임 방어로 클램프(0416).
  const totalPages = Math.max(1, Math.ceil(sorted.length / PLAN_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = sorted.slice((currentPage - 1) * PLAN_PAGE_SIZE, currentPage * PLAN_PAGE_SIZE);

  const withTotal = sorted.filter((p) => p.total > 0);
  // 금액은 "약 N만원" 반올림(기준). 통화 혼재 계획은 지금도 그대로 합산된다 — 별건으로 남김.
  const avgWon = withTotal.length > 0
    ? Math.round(
        withTotal.reduce((s, p) => s + p.total, 0) / withTotal.length / 10_000,
      )
    : null;
  const regionCount = new Set(
    sorted.map((p) => p.region).filter((r): r is string => Boolean(r)),
  ).size;

  return (
    <div>
      {/* 지표 — 굵기 대신 색 밝기로 위계(숫자만 fg, 라벨·구분자는 muted). 굵기는 전부 500. */}
      <p
        className="text-sm font-medium text-muted pb-3.5 border-b border-hairline"
      >
        계획 <span className="text-fg">{sorted.length}개</span>
        {avgWon !== null && (
          <> · 평균 <span className="text-fg">약 {avgWon.toLocaleString()}만원</span></>
        )}
        {regionCount > 0 && (
          <> · 지역 <span className="text-fg">{regionCount}곳</span></>
        )}
      </p>

      <div className="flex flex-wrap gap-2 my-4 relative z-10">
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

      {sorted.length === 0 ? (
        <div className="border-[1.5px] border-dashed border-border rounded-[14px] p-[22px] flex items-center justify-center text-center h-[240px] sm:h-[280px] text-sm text-muted">
          이 가격대 계획이 없어요
        </div>
      ) : (
        // 0535: /my-plan이 WIDE_ROUTES 편입(고르는 화면 = 풀블리드 원칙) — 컨테이너 = 뷰포트−48.
        //   0532에서 캡(1232) 전제로 3열 상한이었던 것을 wide 전제로 재유도해 4·6열 복원.
        //   플랜파인더와 같은 숫자가 되는 건 복사가 아니라 컨테이너·하한·gap이 전부 같아진 결과다
        //   (0530의 복사 사고는 "숫자만 같고 컨테이너가 달랐던" 경우 — 지금은 식 전체가 동일).
        //
        //   산출식(0425 형식): 임계 뷰포트 V(N) = N×하한 + gap×(N−1) + 48(px-6 좌우), 절상 후 +2.
        //   컨테이너 = V−48(상한 없음), gap = 14(sm+), 카드 하한 320.
        //     · 2열: 2×320 + 14×1 + 48 = 702 → min-[704px]
        //     · 3열: 3×320 + 14×2 + 48 = 1036 → min-[1040px]
        //     · 4열: 4×320 + 14×3 + 48 = 1370 → min-[1372px] | 1372에서 카드 320.5
        //     · 6열: 6×320 + 14×5 + 48 = 2038 → min-[2040px] | 2040에서 카드 320.3
        //   하한 320의 근거(0532 실측): MyPlanCard 수축 불가 줄은 금액 줄 212px
        //   (`6인 · 총 약 1,234만원` 123.6 + gap 8 + 좋아요 48.3 + px-4 32, 양쪽 nowrap/shrink-0).
        //   320은 그 위 디자인 여유(1.51배), 잘림 하한은 212.
        //
        //   캡 시절 이력(0532): 기본 분기(1232)에서는 4열 297.5px·6열 194px로 하한 미달이라
        //   두 티어를 제거했었다 — 특히 6열은 컨테이너 고정 탓에 도달 조건이 아예 없는 죽은
        //   분기였다. wide 편입으로 성립 조건이 생겨 복원. 캡 라우트로 되돌리면 다시 깨진다.
        <div
          key={`${sort}-${filter}`}
          className="grid grid-cols-[minmax(min(320px,100%),1fr)] min-[704px]:grid-cols-2 min-[1040px]:grid-cols-3 min-[1372px]:grid-cols-4 min-[2040px]:grid-cols-6 gap-[11px] sm:gap-[14px]"
        >
          {pageItems.map((plan) => (
            <MyPlanCard key={plan.id} {...plan} />
          ))}
          {/* 계획이 1~2개면 3열 그리드 오른쪽이 비어 화면이 미완성으로 읽힌다. 카드를 늘려 채우지 않고
              (그러면 카드마다 폭이 달라진다) 빈 칸을 다음 행동으로 쓴다. 3개부터는 사라짐. */}
          {items.length < 3 && (
            <Link
              href="/my-plan/new"
              className="flex flex-col items-center justify-center gap-2 h-[240px] sm:h-[280px] rounded-[14px] border-[1.5px] border-dashed border-border text-sm font-medium text-muted hover:bg-surface2 hover:text-fg2 transition-colors"
            >
              <Plus size={22} />
              새 계획
            </Link>
          )}
        </div>
      )}

      {/* 0544: 공용 Pagination — totalPages≤1이면 자체 null(3개 미만 채움 칸 구간과 무충돌) */}
      <Pagination
        page={currentPage}
        totalPages={totalPages}
        onGo={(next) => {
          if (next < 1 || next > totalPages || next === currentPage) return;
          setPage(next);
        }}
      />
    </div>
  );
}
