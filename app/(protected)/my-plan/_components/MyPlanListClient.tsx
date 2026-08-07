'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { FilterDropdown } from '@/app/(protected)/plan-finder/_components/FilterDropdown';
import { CardReveal } from '@/app/(protected)/story/_components/CardReveal';
import { MyPlanCard } from './MyPlanCard';

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
        className="text-sm font-medium text-muted pb-3.5 border-b border-hairline appear-up"
        style={{ animationDelay: '0.24s' }}
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
        <div className="border-[1.5px] border-dashed border-border rounded-[14px] p-[22px] flex items-center justify-center text-center h-[240px] sm:h-[280px] text-sm text-muted">
          이 가격대 계획이 없어요
        </div>
      ) : (
        // 0532: 열 브레이크포인트 — 이 화면의 컨테이너로 재산출. 이전엔 플랜파인더 문자열을 그대로
        //   복사하고 "두 목록이 같은 폭에서 같은 열 수로 꺾인다"고 적었으나 사실이 아니었다.
        //   플랜파인더는 WIDE_ROUTES(ProtectedMain)라 컨테이너 = 뷰포트−48로 무한히 넓어지는데,
        //   /my-plan은 기본 분기라 컨테이너 = min(뷰포트−48, 1232)에서 멈춘다.
        //
        //   산출식(0425 형식): 임계 뷰포트 V(N) = N×하한 + gap×(N−1) + 48(px-6 좌우), 절상 후 +2.
        //   컨테이너 = min(V−48, 1232), gap = 14(sm+), 카드 하한 320.
        //     · 2열: 2×320 + 14×1 + 48 = 702 → min-[704px]  | 704에서 카드 321.0
        //     · 3열: 3×320 + 14×2 + 48 = 1036 → min-[1040px] | 1040에서 321.3, 1280↑ 컨테이너캡에서 401.3
        //     · 4열 이상은 성립하지 않는다: 4×320 + 14×3 = 1322 > 1232(컨테이너 상한).
        //   하한 320의 근거(0415는 "메타 줄이 잘리지 않는 최소 폭"이라고만 적고 측정이 없었다):
        //   0532 실측으로 MyPlanCard의 수축 불가 줄은 금액 줄 212px
        //   (`6인 · 총 약 1,234만원` 123.6 + gap 8 + 좋아요 48.3 + px-4 32, 양쪽 다 nowrap/shrink-0).
        //   320은 그 위에 얹은 디자인 여유(1.51배)이고 잘림 하한은 212다.
        //
        //   제거한 죽은 분기 기록 — 구 min-[1372px]:4는 컨테이너캡에서 카드 297.5px(하한 320 미달),
        //   구 min-[2040px]:6은 194px로 **실측 하한 212도 밑돌아** 금액 줄이 overflow-hidden에
        //   실제로 잘렸다. 게다가 컨테이너가 1232에 고정이라 뷰포트를 아무리 키워도 194px 그대로 —
        //   즉 6열 티어는 도달 가능한 조건이 아예 없는 분기였다.
        <div
          key={`${sort}-${filter}`}
          className="grid grid-cols-[minmax(min(320px,100%),1fr)] min-[704px]:grid-cols-2 min-[1040px]:grid-cols-3 gap-[11px] sm:gap-[14px]"
        >
          {sorted.map((plan, i) => (
            <CardReveal key={plan.id} index={i} initialPhaseRef={initialPhaseRef} staggerOnRemount>
              <MyPlanCard {...plan} />
            </CardReveal>
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
    </div>
  );
}
