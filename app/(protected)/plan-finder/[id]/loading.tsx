// 0490: 플랜파인더 상세 진입 로딩 스켈레톤 — 상세 라우트 무방비(2~3초 무피드백) 해소용 route-level fallback.
// 실제 PlanFinderDetail 골격 준용(B-1): 제목 행·메타·지역/작품 칩·"여행 일정" 라벨·Day 탭·타임라인.
// 생략: 소개 카드·항공편·비용·목록 링크(조건부/하단). skeleton-shimmer 재사용(새 애니메이션 없음).
// 폭은 레이아웃 max-w-7xl 상속(PlanFinderDetail처럼 전용 컨테이너 없음).
export default function Loading() {
  return (
    <div aria-hidden>
      <div className="mb-6">
        {/* 제목 + 우측 액션(좋아요는 항상 노출) */}
        <div className="flex items-center justify-between gap-2">
          <div className="h-8 w-[55%] rounded skeleton-shimmer" />
          <div className="h-8 w-16 shrink-0 rounded-full skeleton-shimmer" />
        </div>
        {/* 메타 — 날짜 · 아바타 이름 */}
        <div className="mt-1 flex items-center gap-2">
          <div className="h-3 w-20 rounded skeleton-shimmer" />
          <span aria-hidden className="text-border">·</span>
          <div className="w-5 h-5 rounded-full skeleton-shimmer" />
          <div className="h-3 w-16 rounded skeleton-shimmer" />
        </div>
        {/* 지역·작품 칩 */}
        <div className="mt-2 flex gap-2">
          <div className="h-6 w-16 rounded-full skeleton-shimmer" />
          <div className="h-6 w-20 rounded-full skeleton-shimmer" />
        </div>
      </div>
      {/* "여행 일정" 라벨 */}
      <div className="mb-3 h-3 w-16 rounded skeleton-shimmer" />
      {/* Day 탭 */}
      <div className="mb-6 flex gap-2">
        <div className="h-8 w-16 rounded-full skeleton-shimmer" />
        <div className="h-8 w-16 rounded-full skeleton-shimmer" />
        <div className="h-8 w-16 rounded-full skeleton-shimmer" />
      </div>
      {/* 타임라인 — Day 항목 행 */}
      <div className="flex flex-col gap-3">
        <div className="h-16 w-full rounded-xl skeleton-shimmer" />
        <div className="h-16 w-full rounded-xl skeleton-shimmer" />
        <div className="h-16 w-full rounded-xl skeleton-shimmer" />
        <div className="h-16 w-full rounded-xl skeleton-shimmer" />
      </div>
    </div>
  );
}
