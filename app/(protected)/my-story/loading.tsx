// 0542: MyStory 진입 로딩 — 서버 조회(프로필 + 스토리 전건 + 태그 + 좋아요 집합) 동안
//   무피드백 해소용 route-level fallback. §11 골격 전체 shimmer(눈썹 "MyStory"도 shimmer —
//   타이틀·부제가 닉네임·집계(데이터)라 눈썹만 실물이면 혼합 상태가 헤더 안에서 재발).
// 구조 클래스는 my-story/page.tsx의 짝 블록 준용 — 한쪽만 바꾸면 전환 시프트.
// 그리드·카드는 StorySkeletonGrid 재사용 — MyStoryCardGrid 그리드가 StoryCardList와 클래스
//   완전 동일(0535 재유도 결과).
// 폭: /my-story는 WIDE_ROUTES(풀블리드) — 레이아웃 분기 상속, 전용 래퍼 없음.
import { StorySkeletonGrid } from '@/app/(protected)/story/_components/StorySkeletonGrid';
// 0544: 페이지네이션 도입으로 카드 수 근거를 뷰포트(8)에서 PAGE_SIZE로 정정 —
// 실그리드가 페이지당 STORY_PAGE_SIZE(12)장이라 12건 이상이면 그리드 높이·페이저 위치 정합.
import { STORY_PAGE_SIZE } from '@/lib/story/queries';

export default function Loading() {
  return (
    <div aria-hidden>
      {/* 헤더 행 짝 — [아바타 56px][눈썹+타이틀+부제] 좌 / 검색바 우 (page.tsx 반응형 스택) */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full shrink-0 skeleton-shimmer" />
          <div>
            {/* 눈썹 text-xs lh 16 + mb-1 / 타이틀 text-xl·md:text-3xl 유틸 → lh 내장 28/36 /
                부제 text-sm lh 20 + mt-1 */}
            <div className="h-4 mb-1 flex items-center">
              <div className="h-3 w-14 rounded skeleton-shimmer" />
            </div>
            <div className="h-7 md:h-9 flex items-center">
              <div className="h-5 md:h-7 w-52 rounded skeleton-shimmer" />
            </div>
            <div className="h-5 mt-1 flex items-center">
              <div className="h-3.5 w-32 rounded skeleton-shimmer" />
            </div>
          </div>
        </div>
        {/* 검색바 짝 — TagSearchBar input(w-full md:w-70 · rounded-full), story/(list) 로딩과 동일 */}
        <div className="h-10 w-full md:w-70 rounded-full skeleton-shimmer" />
      </div>

      {/* 카드 그리드 — 실그리드(MyStoryCardGrid)와 동일 치수의 공용 스켈레톤 재사용 */}
      <StorySkeletonGrid count={STORY_PAGE_SIZE} />

      {/* 0544: 페이저 자리 — 공용 Pagination(mt-10 + h-11 셀) 짝. 대표형 = totalPages>1.
          폭 332 = 7셀×44 + gap 6×4 근사(슬롯 수 반응형이라 정확 일치 불가). */}
      <div className="mt-10 flex justify-center">
        <div className="skeleton-shimmer h-11 w-[332px] max-w-full rounded-[14px]" />
      </div>
    </div>
  );
}
