// 플랜파인더 첫 진입(서버 페치 중) 로딩 스켈레톤 — 0414(0412 교체).
// 스켈레톤은 "아직 모르는 것"에만 씌운다(0413 원칙):
//  · 눈썹·타이틀은 서버 응답과 무관한 정적 텍스트 → 실제 PlanFinderHeader 그대로 렌더(셔머로 덮으면 같은 글자 재출현 = 깜빡임).
//  · 요약줄·필터는 셔머 — 공개 코스 수·평균가·필터 상태는 데이터 의존.
//  · 카드 그리드는 PlanSkeletonGrid 재사용, count=PLAN_PAGE_SIZE(한 페이지 카드 수와 동일 → 전환 시 시프트 없음).
// 셔머는 skeleton-shimmer 유틸 재사용(globals.css, popover/surface2 토큰 · 라이트/다크 자동).
import { PLAN_PAGE_SIZE } from '@/lib/plan/pagination';
import { PlanFinderHeader } from './_components/PlanFinderHeader';
import { PlanSkeletonGrid } from './_components/PlanSkeletonGrid';

export default function Loading() {
  return (
    <div>
      {/* 헤더 행 — PlanListClient와 동일 레이아웃(눈썹·타이틀·요약 좌 / 필터 우) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4 sm:mb-6">
        <div>
          <PlanFinderHeader />
          {/* 요약줄 자리 — PlanListClient의 text-[12.5px] mt-4 sm:mt-5 매칭 */}
          <div className="skeleton-shimmer h-[13px] w-44 rounded mt-4 sm:mt-5" aria-hidden />
        </div>
        {/* 필터 2개 자리 — FilterDropdown 버튼(px-4 py-1.5 rounded-full ≈ h-8) 근사 */}
        <div className="flex flex-wrap gap-2" aria-hidden>
          <div className="skeleton-shimmer h-8 w-[70px] rounded-full" />
          <div className="skeleton-shimmer h-8 w-[80px] rounded-full" />
        </div>
      </div>

      {/* 카드 그리드 — 실제 PlanListClient 그리드와 동일 치수 */}
      <PlanSkeletonGrid count={PLAN_PAGE_SIZE} />
    </div>
  );
}
