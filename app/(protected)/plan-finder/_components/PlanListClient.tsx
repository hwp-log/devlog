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
import { getImageProps } from 'next/image';
import type { PublicPlanListItem } from '@/lib/plan/queries';
import { PLAN_PAGE_SIZE } from '@/lib/plan/pagination';
import { PLAN_CARD_SIZES } from '@/lib/card-tokens';
import { PlanCard } from './PlanCard';
import { FilterDropdown } from './FilterDropdown';
import { PlanFinderHeader } from './PlanFinderHeader';
import { Pagination } from '../../_components/Pagination';
import { TagSearchBar } from '@/app/(protected)/story/_components/TagSearchBar';

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
  // 0552: 검색 — MyPlan(0548)과 같은 층·같은 방식. 전량이 이미 클라에 있어 파이프라인
  // (검색 → 가격대 → 정렬 → slice)에 한 단계만 추가하면 지표·페이저·프리로드가 전부 정합.
  // query는 TagSearchBar가 정규화한 값(trim·공백·# 제거).
  const [query, setQuery] = useState('');

  // 페이지 전환 애니메이션 없음(0430, 0427·0429 되돌림): 데이터가 이미 클라이언트에 있어
  // 즉시 교체하면 빈 구간도 번쩍임도 없다. 서버 대기가 0이라 스켈레톤이 한 프레임만 스쳐 번쩍이던 문제 제거.
  // 0431: 인접 페이지 커버까지 프리로드해 넘김 순간 이미지 pop-in도 없앤다(아래 프리로드 effect).
  // 진입 로딩(loading.tsx)은 실제 서버 대기이므로 그대로 유지.

  // 페이지 변경 시 문서 최상단으로(스토리와 동일 UX). 첫 마운트는 skip.
  // useLayoutEffect: 슬라이스 교체 커밋 후·페인트 전 실행 → 새 페이지가 이전 스크롤 위치로 그려지는 프레임 없음.
  const didMount = useRef(false);
  useIsoLayoutEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    window.scrollTo(0, 0);
  }, [page]);

  // 0552: 검색 단계 — 제목·지역·작품 + 작성자(공개 목록은 "그 사람 코스 다시 찾기"가 용례라
  // authorNickname 포함, 내 목록(0548)과의 차이). 공백 제거 비교는 정규화와 짝(0548).
  const q = query.toLowerCase();
  const searched = q === ''
    ? plans
    : plans.filter((p) =>
        [p.title, p.region, p.movie, p.authorNickname].some(
          (f) => f != null && f.replace(/\s/g, '').toLowerCase().includes(q),
        ),
      );

  const filtered = filter === 'all'
    ? searched
    : searched.filter((p) => getFilterKey(p) === filter);

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'popular') return b.likeCount - a.likeCount;
    if (sort === 'newest')  return b.createdAt.getTime() - a.createdAt.getTime();
    const aLower = a.summary.band?.lower ?? (sort === 'price_asc' ? Infinity : -1);
    const bLower = b.summary.band?.lower ?? (sort === 'price_asc' ? Infinity : -1);
    return sort === 'price_asc' ? aLower - bLower : bLower - aLower;
  });

  // 0553: 지역 수 — MyPlan 지표줄과 동일 수법(non-null region distinct). 검색·필터 반영 집합 기준.
  const regionCount = new Set(
    sorted.map((p) => p.region).filter((r): r is string => Boolean(r)),
  ).size;

  // 클라이언트 슬라이스: 정렬·필터 완료된 sorted를 PLAN_PAGE_SIZE(12)개씩 자름(개수는 sorted.length 그대로 노출).
  // 필터·정렬 변경 시 setPage(1)로 되돌리므로 page는 항상 유효하나, 리셋 직전 프레임 방어로 클램프.
  const totalPages = Math.max(1, Math.ceil(sorted.length / PLAN_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = sorted.slice((currentPage - 1) * PLAN_PAGE_SIZE, currentPage * PLAN_PAGE_SIZE);

  // 0431: 인접 페이지(이전·다음) 커버를 미리 받아 페이지 넘김 순간의 깜빡임 제거.
  //   원인(네트워크 실측): 넘기는 순간 다음 12장이 그제서야 요청돼 폴백→채움이 보인 것.
  //   전환 연출로는 못 감추고 미리 받는 게 유일한 해법이라 프리로드로 해결(전환 방식은 즉시 교체 유지).
  //   currentPage 기준 앞뒤 한 페이지분만. coverUrl null은 제외.
  const adjacentCovers: string[] = [];
  if (currentPage > 1) {
    for (const p of sorted.slice((currentPage - 2) * PLAN_PAGE_SIZE, (currentPage - 1) * PLAN_PAGE_SIZE)) {
      if (p.coverUrl) adjacentCovers.push(p.coverUrl);
    }
  }
  if (currentPage < totalPages) {
    for (const p of sorted.slice(currentPage * PLAN_PAGE_SIZE, (currentPage + 1) * PLAN_PAGE_SIZE)) {
      if (p.coverUrl) adjacentCovers.push(p.coverUrl);
    }
  }
  // 매 렌더 새 배열이라 effect 재실행 방지용 문자열 키(내용이 바뀔 때만 실행).
  const adjacentKey = adjacentCovers.join('|');

  // 0431: 인접 페이지 커버 프리로드. 핵심은 next/image가 실제 요청할 최적화 URL과 같아야 캐시가 맞는다는 것.
  //   getImageProps에 PlanCard와 동일한 props(fill + PLAN_CARD_SIZES)를 넣어 같은 srcSet을 얻고,
  //   detached Image에 srcset+sizes를 그대로 세팅 → 브라우저가 카드 렌더 때와 동일한 후보를 선택·요청.
  //   이미 받은 URL은 Set으로 기억해 중복 요청 방지. 실패는 조용히 무시(화면 영향 없음).
  const preloadedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const coverUrl of adjacentCovers) {
      if (preloadedRef.current.has(coverUrl)) continue;
      preloadedRef.current.add(coverUrl);
      try {
        const { props } = getImageProps({ src: coverUrl, alt: '', fill: true, sizes: PLAN_CARD_SIZES });
        const img = new Image();
        img.onerror = () => {};        // 실패는 조용히 무시
        if (props.sizes) img.sizes = props.sizes;
        if (props.srcSet) img.srcset = props.srcSet;
        img.src = props.src;           // srcSet 미지원 폴백
      } catch {
        // getImageProps/Image 생성 실패도 무시
      }
    }
    // adjacentCovers는 매 렌더 새 배열 → adjacentKey(내용 문자열)로 안정화
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjacentKey]);

  // 페이지 넘김: 즉시 슬라이스 교체(+ layout effect 최상단 스크롤). 클라 데이터라 대기·전환 없음.
  const goTo = (next: number) => {
    if (next < 1 || next > totalPages || next === currentPage) return;
    setPage(next);
  };

  return (
    <div>
      <PlanFinderHeader />

      {/* 0552: [지표(좌) ··· 검색바(우)] 한 행 — MyPlan(0551)과 동일 배치·동일 클래스(짝).
          hairline은 행 전체 마감, 모바일 세로 스택(지표 → 검색바), 정렬 center.
          검색 수신은 0548 방식: onNavigate 위임(디바운스·IME 내장, URL 네비 없음). */}
      <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between pb-3.5 border-b border-hairline">
        {/* 공개 코스 수는 서버 데이터(sorted.length) 파생 — 검색·필터 반영값.
            평균 금액 제거(0441) — 인원수가 제각각이라 평균이 유의미하지 않음.
            0553: 글자 스타일·숫자 강조는 MyPlan 지표줄(MyPlanListClient)과 짝 — 한쪽만 바꾸면 갈린다. */}
        <p className="text-sm font-medium text-muted">
          공개 코스 <span className="text-fg">{sorted.length}개</span>
          {regionCount > 0 && (
            <> · 지역 <span className="text-fg">{regionCount}곳</span></>
          )}
        </p>
        <div className="w-full md:w-auto md:shrink-0">
          <TagSearchBar
            q=""
            basePath="/plan-finder"
            placeholder="제목, 지역, 작품, 작성자를 입력하세요"
            onNavigate={(url) => {
              setQuery(new URL(url, location.origin).searchParams.get('q') ?? '');
              setPage(1); // 결과 집합 변경 → 1페이지 복귀(0544·0548 동일 지점)
            }}
          />
        </div>
      </div>

      {/* 필터 줄 — 좌측(0552, MyPlan 필터 줄과 동일 문법) */}
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
        <div className="border-[1.5px] border-dashed border-border rounded-[14px] p-[22px] flex flex-col items-center text-center gap-3">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <p className="text-[13px] leading-[1.6] text-fg2 break-keep">
            {query ? `"${query}"에 맞는 코스가 없어요.` : '이 가격대의 코스가 아직 없어요.'}
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
        // ⚠ 0532: 이 값들은 **WIDE 분기 전용**이다. 위 "콘텐츠 폭 = 뷰포트−48"은 이 라우트가
        //   ProtectedMain의 WIDE_ROUTES에 있어 max-w가 없기 때문에 성립한다. 기본 분기 라우트는
        //   컨테이너가 min(뷰포트−48, 1232)라 같은 숫자를 쓰면 카드가 하한을 깬다 —
        //   /my-plan이 이 문자열을 복사했다가 4열 297.5px·6열 194px(실측 잘림 하한 212 미만)로
        //   깨졌고 0532에서 자기 컨테이너로 재산출했다. 다른 목록에 옮길 땐 숫자가 아니라 산출식을 옮길 것.
        // 0532 실측: 하한 320의 잘림 근거는 PlanCard 금액 줄 227px
        //   (`6인 · 총 약 1,234만원` 123.6 + gap 8 + `코스 보기 →` 62.7 + px-4 32, 양쪽 nowrap).
        //   320은 그 위 디자인 여유(1.41배)다. 0415가 "메타 줄이 잘리지 않는 최소 폭"이라 적고
        //   측정을 남기지 않아 320이 잘림 하한으로 오해될 여지가 있었다.
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
