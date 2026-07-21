'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { StoryCardList } from './StoryCardList';
import { StorySkeletonGrid } from './StorySkeletonGrid';
import type { StoryCardProps } from './StoryCard';

// 검색창 input과 "검색하기" 버튼을 잇는 DOM id. page.tsx가 TagSearchBar에 이 id를 넘김.
export const STORY_SEARCH_INPUT_ID = 'story-tag-search';

// SSR useLayoutEffect 경고 회피 — 스크롤은 클라 전용
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface Props {
  items: StoryCardProps[]; // 서버 주도 — page.tsx가 searchParams(page)로 fetch해 내려줌(클라 데이터 state 없음)
  page: number;
  totalPages: number;
  keyword: string;
  pageSize: number; // 부분 페이지를 이 개수만큼 빈 셀로 채워 그리드 높이 통일(번호 바 위치 고정)
  isPending: boolean; // StoryBrowser의 공용 transition — 검색·페이지 넘김 둘 다 fetch 중 true(스켈레톤 트리거)
  navigate: (url: string) => void; // 공용 네비게이션(공유 transition으로 router.replace 래핑)
}

/** 첫·현재·마지막 고정, 중간 …생략. 반환 길이 = slots(total>slots일 때). */
function buildPages(current: number, total: number, slots: number): (number | 'ellipsis')[] {
  if (total <= slots) return Array.from({ length: total }, (_, i) => i + 1);
  const inner = slots - 2; // 1·total 제외 중간 예산(…포함)
  let left = Math.max(2, current - Math.floor((inner - 1) / 2));
  const right = Math.min(total - 1, left + inner - 1);
  left = Math.max(2, right - inner + 1); // 우측 경계 보정
  const showLeft = left > 2;
  const showRight = right < total - 1;
  // …가 슬롯 1칸 차지 → 숫자 창을 한 칸씩 축소해 총 길이 유지
  const from = showLeft ? left + 1 : left;
  const to = showRight ? right - 1 : right;
  const out: (number | 'ellipsis')[] = [1];
  if (showLeft) out.push('ellipsis');
  for (let p = from; p <= to; p++) out.push(p);
  if (showRight) out.push('ellipsis');
  out.push(total);
  return out;
}

export function StoryListPaged({ items, page, totalPages, keyword, pageSize, isPending, navigate }: Props) {
  const [slots, setSlots] = useState(7); // SSR·초기값 7(서버와 일치) → 마운트 후 폭 감지
  const didMount = useRef(false);

  // 크로스페이드 로딩(첫 진입·페이지 넘김 동일 경로):
  //  loading  = 스켈레톤 표시(카드 숨김)  / revealing = 스켈레톤 페이드아웃 + 카드 페이드인 / idle = 카드만.
  // 스켈레톤은 항상 flow(높이 기준) — 카드는 절대 오버레이. 첫 페인트=loading(SSR도 스켈레톤).
  const [phase, setPhase] = useState<'loading' | 'revealing' | 'idle'>('loading');
  const wasPending = useRef(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beginReveal = () => {
    setPhase('revealing');
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => setPhase('idle'), 300);
  };

  // 첫 진입: 스켈레톤(초기) → 다음 프레임 크로스페이드 → 카드 (페이지 넘김과 동일)
  useEffect(() => {
    const r = requestAnimationFrame(() => beginReveal());
    return () => {
      cancelAnimationFrame(r);
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 페이지 넘김: isPending true=로딩 / false=데이터 도착 → 크로스페이드
  useEffect(() => {
    if (isPending && !wasPending.current) {
      if (revealTimer.current) clearTimeout(revealTimer.current);
      setPhase('loading');
    } else if (!isPending && wasPending.current) {
      beginReveal();
    }
    wasPending.current = isPending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending]);

  // (검색은 StoryBrowser 공용 transition으로 isPending을 켜므로 위 isPending effect가 그대로 처리 — 별도 감지 불필요)

  // 반응형 slots: <lg 5칸 / lg+ 7칸. useEffect라 hydration mismatch 없음(첫 페인트=7)
  useEffect(() => {
    const update = () => setSlots(window.innerWidth >= 1024 ? 7 : 5);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // 페이지(prop) 변경 시 문서 최상단으로 instant 스크롤. 그리드 위쪽(헤더행)은 고정 높이라
  // y=0에서 그리드 상단이 항상 동일 위치 → 경로·페이지 높이 무관 일관(클램프 없음). 초기 마운트는 skip.
  // useLayoutEffect: 새 콘텐츠 커밋 후·페인트 전 실행 → 스크롤 위치 플래시 없음.
  useIsoLayoutEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    window.scrollTo(0, 0);
  }, [page]);

  // 공용 navigate(공유 transition) → URL만 갱신·RSC 재요청. 검색과 같은 isPending 경로.
  const goTo = (next: number) => {
    if (next < 1 || next > totalPages || next === page || isPending) return;
    const params = new URLSearchParams();
    if (keyword) params.set('q', keyword);
    if (next > 1) params.set('page', String(next));
    const qs = params.toString();
    navigate(qs ? `/story?${qs}` : '/story');
  };

  // 검색창으로 smooth 스크롤 + focus(브라우저 기본 포커스 테두리, 별도 글로우 없음)
  const focusSearch = () => {
    const el = document.getElementById(STORY_SEARCH_INPUT_ID);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (el as HTMLInputElement).focus({ preventScroll: true });
  };

  const pages = buildPages(page, totalPages, slots);
  const cell = 'inline-flex h-11 w-11 items-center justify-center rounded-[14px] text-sm transition-colors';

  return (
    <>
      {/* 스테이지: 스켈레톤(항상 flow=높이 기준, pageSize 고정) + 카드(절대 오버레이). 크로스페이드.
          스테이지 높이 = 스켈레톤(제목 편차 없는 고정 높이) → 카드 개수·제목 무관 번호 바 위치 고정. */}
      <div className="relative">
        <div className={`transition-opacity duration-[280ms] ${phase === 'loading' ? 'opacity-100' : 'opacity-0'}`}>
          {/* 높이 기준 = pageSize 상수(데이터 개수 무관). 업계 표준(페이지당 높이 고정 + 데이터 채움) →
              페이지 넘김·검색·마지막 페이지 모두 번호바·푸터 세로 위치 완전 고정. 결과 적을 때 아래 빈 공간은 용인. */}
          <StorySkeletonGrid count={pageSize} shimmer={phase !== 'idle'} />
        </div>
        <div
          className={`absolute inset-0 transition-opacity duration-[280ms] ${
            phase === 'loading' ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <StoryCardList stories={items} />
        </div>
      </div>

      {totalPages > 1 && (
        <nav aria-label="페이지 네비게이션" className="mt-10 flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => goTo(page - 1)}
            disabled={page === 1 || isPending}
            aria-label="이전 페이지"
            className={`${cell} text-fg2 hover:bg-surface2 disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <ChevronLeft size={18} />
          </button>

          {pages.map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`e${i}`} aria-hidden className={`${cell} text-muted select-none`}>
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => goTo(p)}
                disabled={isPending}
                aria-label={`${p}페이지`}
                aria-current={p === page ? 'page' : undefined}
                className={`${cell} ${
                  p === page
                    ? 'bg-primary font-medium text-white'
                    : 'text-fg2 hover:bg-surface2 disabled:cursor-not-allowed'
                }`}
              >
                {p}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => goTo(page + 1)}
            disabled={page === totalPages || isPending}
            aria-label="다음 페이지"
            className={`${cell} text-fg2 hover:bg-surface2 disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <ChevronRight size={18} />
          </button>
        </nav>
      )}

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={focusSearch}
          className="py-2 text-sm text-muted hover:text-fg2 transition-colors"
        >
          찾는 촬영지가 있나요? <span className="font-medium text-primary">검색하기</span>
        </button>
      </div>
    </>
  );
}
