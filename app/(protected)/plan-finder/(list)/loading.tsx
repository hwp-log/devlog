// 플랜파인더 첫 진입(서버 페치 중) 로딩 스켈레톤 — 0414(0412 교체).
// 스켈레톤은 "아직 모르는 것"에만 씌운다(0413 원칙):
//  · 눈썹·타이틀은 서버 응답과 무관한 정적 텍스트 → 실제 PlanFinderHeader 그대로 렌더(셔머로 덮으면 같은 글자 재출현 = 깜빡임).
//  · 요약줄·필터는 셔머 — 공개 코스 수·평균가·필터 상태는 데이터 의존.
//  · 카드 그리드는 PlanSkeletonGrid 재사용, count=PLAN_PAGE_SIZE(한 페이지 카드 수와 동일 → 전환 시 시프트 없음).
// 셔머는 skeleton-shimmer 유틸 재사용(globals.css, popover/surface2 토큰 · 라이트/다크 자동).
import { PLAN_PAGE_SIZE } from '@/lib/plan/pagination';
import { PlanFinderHeader } from '../_components/PlanFinderHeader';
import { PlanSkeletonGrid } from '../_components/PlanSkeletonGrid';

export default function Loading() {
  return (
    <div>
      {/* 진입 로딩에서만 등장 애니메이션 재생 — 콘텐츠 헤더는 정적이라 로딩→콘텐츠 전환 시 이중 재생 없음(0445) */}
      <PlanFinderHeader animate />

      {/* 0552: [지표 바(좌) ··· 검색바 자리(우)] 한 행 짝 — PlanListClient(0551 MyPlan 동조 배치)와
          동일 구조(mt-2 · md:items-center · pb-3.5 + hairline 행 전체 마감. 옅은 구조선 실색, §11).
          지표 text-[12.5px] lh ≈ 19px 박스 근사 h-5 */}
      <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between pb-3.5 border-b border-hairline" aria-hidden>
        <div className="h-5 flex items-center">
          <div className="skeleton-shimmer h-[13px] w-32 rounded" />
        </div>
        <div className="skeleton-shimmer h-10 w-full md:w-70 rounded-full" />
      </div>

      {/* 필터 2개 자리(좌, my-4) — FilterDropdown 버튼(px-4 py-1.5 rounded-full ≈ h-8) 근사 */}
      <div className="flex flex-wrap gap-2 my-4" aria-hidden>
        <div className="skeleton-shimmer h-8 w-[70px] rounded-full" />
        <div className="skeleton-shimmer h-8 w-[80px] rounded-full" />
      </div>

      {/* 카드 그리드 — 실제 PlanListClient 그리드와 동일 치수 */}
      <PlanSkeletonGrid count={PLAN_PAGE_SIZE} />

      {/* 0542: 페이저 자리 — 공용 Pagination(mt-10 + h-11 셀) 짝. 자리를 안 잡으면 전환 시
          페이저가 튀어나와 하단·푸터가 출렁임. 대표형 = totalPages>1(목록이 페이지 크기 초과).
          폭 332 = 7셀×44 + gap 6×4 근사(슬롯 수 반응형이라 정확 일치 불가). */}
      <div className="mt-10 flex justify-center" aria-hidden>
        <div className="skeleton-shimmer h-11 w-[332px] max-w-full rounded-[14px]" />
      </div>
    </div>
  );
}
