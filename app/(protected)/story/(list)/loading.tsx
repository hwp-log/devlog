// 스토리 목록 첫 진입(서버 페치 중) 로딩 스켈레톤 — 0413.
// 다른 화면에서 이동해 올 때의 진입 표시. 화면 내 useTransition 로딩(StoryListPaged)과는 별개 층.
// 스켈레톤은 "아직 모르는 것"에만 씌운다:
//  · 눈썹·타이틀은 서버 응답과 무관한 정적 텍스트 → 실제 StoryHeader 그대로 렌더(셔머로 덮으면 같은 글자 재출현 = 깜빡임).
//  · 검색바는 셔머로 — 실제 input을 그리면 입력 가능해 보이나 핸들러가 없어 입력이 유실됨.
//  · 카드 그리드는 StorySkeletonGrid 재사용, count=STORY_PAGE_SIZE로 초기 페인트 스켈레톤과 동일 치수(전환 시 시프트 없음).
// 셔머는 skeleton-shimmer 유틸 재사용(globals.css, popover/surface2 토큰 · 라이트/다크 자동).
import { StoryHeader } from '../_components/StoryHeader';
import { StorySkeletonGrid } from '../_components/StorySkeletonGrid';
import { STORY_PAGE_SIZE } from '@/lib/story/queries';

export default function Loading() {
  return (
    <div>
      {/* 헤더 행 — StoryBrowser와 동일 레이아웃(눈썹·타이틀 좌 / 검색바 우) */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <StoryHeader />
        {/* 검색바 자리 — TagSearchBar input의 w-full md:w-70 · rounded-full 매칭 */}
        <div className="skeleton-shimmer h-10 w-full md:w-70 rounded-full" aria-hidden />
      </div>

      {/* 카드 그리드 — 초기 페인트 스켈레톤과 동일 치수 */}
      <StorySkeletonGrid count={STORY_PAGE_SIZE} />
    </div>
  );
}
