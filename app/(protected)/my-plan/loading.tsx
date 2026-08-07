// 0542: MyPlan 진입 로딩 — 서버 조회(프로필 + 계획 전건 include) 동안 무피드백 해소용
//   route-level fallback. §11 골격 전체 shimmer(눈썹 "MyPlan"도 shimmer — 타이틀이 닉네임
//   포함(데이터)이라 눈썹만 실물이면 "이건 온 것, 저건 아직"이 헤더 안에서 재발.
//   크롬 예외는 헤더 전체가 정적일 때(0413)만).
// 구조 클래스는 my-plan/page.tsx·MyPlanListClient의 짝 블록 준용 — 한쪽만 바꾸면 전환 시프트.
// 그리드·카드는 PlanSkeletonGrid 재사용 — MyPlanListClient 그리드가 PlanListClient와 클래스
//   완전 동일(0535 재유도 결과)·카드 높이 동일(240/280, 빈 판 주석 방증).
// 폭: /my-plan은 WIDE_ROUTES(풀블리드) — 레이아웃 분기 상속, 전용 래퍼 없음.
import { PlanSkeletonGrid } from '@/app/(protected)/plan-finder/_components/PlanSkeletonGrid';

// 카드 8 = 최대 밀도 4열 구간(1372~2040) 2행 — 전건 렌더라 PAGE_SIZE가 없어 첫 뷰포트
// 채움(헤더~필터 ≈200px + 280px 2행)을 근거로. 6열(2040+)에선 1.33행이나 초광폭 예외 수용.
const CARD_COUNT = 8;

export default function Loading() {
  return (
    <div aria-hidden>
      {/* 헤더 행 짝 — [아바타 56px][눈썹+타이틀] 좌 / 새 계획 버튼 우 (page.tsx mb-6) */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full shrink-0 skeleton-shimmer" />
          <div>
            {/* 눈썹 text-xs lh 16 + mb-1 / 타이틀 text-[21px] md:[28px] arbitrary → lh 1.5 = 32/42px 박스 */}
            <div className="h-4 mb-1 flex items-center">
              <div className="h-3 w-14 rounded skeleton-shimmer" />
            </div>
            <div className="h-8 md:h-[42px] flex items-center">
              <div className="h-6 md:h-7 w-52 rounded skeleton-shimmer" />
            </div>
          </div>
        </div>
        {/* 새 계획 버튼 짝 — min-h-11 rounded-full, 폭은 아이콘+텍스트 근사 */}
        <div className="h-11 w-[110px] shrink-0 rounded-full skeleton-shimmer" />
      </div>

      {/* 지표줄 짝 — MyPlanListClient(text-sm lh 20 + pb-3.5 + hairline. 옅은 구조선은 실색, §11) */}
      <div className="pb-3.5 border-b border-hairline">
        <div className="h-5 flex items-center">
          <div className="h-3.5 w-64 max-w-full rounded skeleton-shimmer" />
        </div>
      </div>

      {/* 필터 2개 짝 — FilterDropdown 버튼(px-4 py-1.5 rounded-full ≈ h-8) 근사, my-4 */}
      <div className="flex flex-wrap gap-2 my-4">
        <div className="h-8 w-[80px] rounded-full skeleton-shimmer" />
        <div className="h-8 w-[70px] rounded-full skeleton-shimmer" />
      </div>

      {/* 카드 그리드 — 실그리드(MyPlanListClient)와 동일 치수의 공용 스켈레톤 재사용 */}
      <PlanSkeletonGrid count={CARD_COUNT} />
    </div>
  );
}
