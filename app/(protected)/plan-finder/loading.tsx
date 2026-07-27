// 플랜파인더 첫 진입(서버 페치 중) 로딩 스켈레톤.
// 헤더 행 + 카드 그리드를 실제 레이아웃과 동일 치수로 채운다.
// 셔머 표면은 skeleton-shimmer 유틸 재사용(globals.css, popover/surface2 토큰 · 1.4s · reduced-motion 대응).
export default function Loading() {
  return (
    <div aria-hidden>
      {/* 헤더 행 — PlanListClient와 동일 레이아웃(눈썹·타이틀·요약 좌 / 필터 우) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4 sm:mb-6">
        <div>
          <div className="skeleton-shimmer h-[11px] w-16 rounded" />
          <div className="skeleton-shimmer h-5 w-36 rounded mt-3" />
          <div className="skeleton-shimmer h-[14px] w-44 rounded mt-4 sm:mt-5" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="skeleton-shimmer h-8 w-[72px] rounded-full" />
          <div className="skeleton-shimmer h-8 w-[64px] rounded-full" />
        </div>
      </div>

      {/* 카드 그리드 — 데스크톱 3열 / 모바일 1열, 카드 3개 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[11px] sm:gap-[14px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-[14px] h-[240px] sm:h-[280px] flex flex-col justify-end gap-2.5 p-4"
          >
            <div className="skeleton-shimmer h-3 w-3/5 rounded" />
            <div className="skeleton-shimmer h-3 w-[45%] rounded" />
            <div className="skeleton-shimmer h-[26px] w-2/5 rounded" />
            <div className="skeleton-shimmer h-3 w-[35%] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
