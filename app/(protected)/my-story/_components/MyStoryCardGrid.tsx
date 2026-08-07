'use client';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { type StoryCardProps } from '@/app/(protected)/story/_components/StoryCard';
import { MyStoryCard } from './MyStoryCard';
import { Pagination } from '@/app/(protected)/_components/Pagination';

type MyStoryItem = StoryCardProps;

// SSR useLayoutEffect 경고 회피 — 스크롤은 클라 전용 (PlanListClient·StoryListPaged와 동일
// 1줄 alias. lib 추출은 두 파일 수정을 수반해 미룸 — 바꿀 땐 네 곳 함께)
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// 0542: CardReveal 등장 연출 제거 — 진입 로딩 스켈레톤(loading.tsx) 신설로 등장 연출이
// 이중이 됨. 무연출 즉시 렌더는 plan-finder 실그리드(0430)와 동일 구조.
// 0544: 클라이언트 슬라이스 페이지네이션(0416 방식) — 검색(?q=) 변경 시 페이지 리셋은
// page.tsx의 <ViewTransition key={listKey}>가 결과 변경 때 이 컴포넌트를 remount시켜 담당.
// pageSize는 prop 주입 — STORY_PAGE_SIZE 정본(lib/story/queries)이 prisma를 import해
// 클라이언트에서 직접 가져올 수 없다(StoryListPaged와 동일 사정·동일 방식).
export function MyStoryCardGrid({ stories, pageSize }: { stories: MyStoryItem[]; pageSize: number }) {
  const [page, setPage] = useState(1);

  // 페이지 변경 시 문서 최상단으로(다른 목록과 동일 UX). 첫 마운트는 skip.
  const didMount = useRef(false);
  useIsoLayoutEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    window.scrollTo(0, 0);
  }, [page]);

  // stories는 이미 서버 필터(검색) 완료분 — pageSize(STORY_PAGE_SIZE=12)씩 슬라이스. 방어 클램프는 0416 동일.
  const totalPages = Math.max(1, Math.ceil(stories.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = stories.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      {/* 0532: 구 1/md:2/lg:3/xl:4는 0042 당시 /story 체계를 옮겨온 것으로, 이후 /story가 바뀔 때
            갱신되지 않아 네 번째 체계로 남아 있었다. 이 화면의 컨테이너로 재산출한다.
          0535: /my-story가 WIDE_ROUTES 편입(고르는 화면 = 풀블리드 원칙) — 컨테이너 = 뷰포트−48.
            0532의 캡(1232) 전제에서 불성립이던 6열(6×220+24×5=1440>1232)이 성립하게 돼 복원.
            /story(StoryCardList)와 같은 숫자가 되는 건 복사가 아니라 컨테이너·하한·gap이 전부
            같아진 결과 — 캡 라우트로 되돌리면 6열부터 다시 깨진다.

            산출식(0425 형식): 임계 뷰포트 V(N) = N×하한 + gap×(N−1) + 48(px-6 좌우), 절상 후 +2.
            컨테이너 = V−48(상한 없음). gap = 24. 카드는 /story와 같은 StoryCard라 하한도 220 공유.
            ⚠ 0545: 모바일 1열은 실기기 판정(0448·0545)으로 고정 — 계산 결과보다 우선
              (근거 상세는 StoryCardList 주석. 세 그리드 클래스 동일 유지 필수).
              · 2열: 실기기 판정 640 → min-[640px] (산출식 최소점 512는 미채택)
              · 3열: 3×220 + 24×2 + 48 = 756 → min-[758px]  | 758에서 220.7
              · 4열: 4×220 + 24×3 + 48 = 1000 → min-[1002px] | 1002에서 220.5
              · 6열: 6×220 + 24×5 + 48 = 1488 → min-[1490px] | 1490에서 카드 220.3

            하한 220 근거는 StoryCardList 주석 참조(메타 줄 실측 159px). 특히 날짜 폭은
            `2025년 12월 31일` 기준 91.2px으로 잡혀 있다 — formatStoryCardDate가 해가 바뀌면
            `M월 D일`(37.5)에서 `YYYY년 M월 D일`로 되돌리므로, 2027년 1월에 기존 스토리 전건이
            그 폭이 된다. 220은 그 상태를 이미 전제한 값이다. */}
      <div className="grid grid-cols-1 min-[640px]:grid-cols-2 min-[758px]:grid-cols-3 min-[1002px]:grid-cols-4 min-[1490px]:grid-cols-6 gap-6">
        {pageItems.map((story) => (
          <MyStoryCard key={story.id} {...story} />
        ))}
      </div>

      {/* 0544: 공용 Pagination — totalPages≤1이면 자체 null */}
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
